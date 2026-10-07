import { describe, it, expect } from 'vitest';
import { makeDemoTrip } from '../utils/demoTrip.js';
import { computeBalances } from '../utils/balances.js';
import { settleUp } from '../utils/settlement.js';
import { computeShares } from '../utils/splits.js';
import { keywordSticker } from '../utils/stickers.js';
import { parseClassifierJson, createClassifier, stickerFromAi } from '../utils/classify.js';
import { buildAnthropicRequest } from '../utils/classifyPrompt.js';
import { stopQuip, tripBadges, wrapText, settleKey, personLine } from '../utils/copy.js';
import { buildSchedule, reachedAt, lengthAt, legAt, cubicBezier, REDUCED_TIMING } from '../utils/trailTimeline.js';
import { layoutTrail, stickerSize, fitLabel } from '../utils/trailLayout.js';
import { formatMoney } from '../utils/money.js';

let n = 0;
const trip = makeDemoTrip(() => `id${n++}`);
const nameId = Object.fromEntries(trip.participants.map((p) => [p.name, p.id]));
const byName = (rows) => Object.fromEntries(rows.map((r) => [r.name, r]));

describe('demo trip money (section 8)', () => {
  const balances = computeBalances(trip.participants, trip.expenses);

  it('every expense splits to exactly its total', () => {
    for (const e of trip.expenses) expect(Object.values(computeShares(e)).reduce((a, b) => a + b, 0)).toBe(e.amount);
  });

  it('produces the expected nets, summing to zero', () => {
    const b = byName(balances);
    expect(b.priya.net).toBe(1035000);
    expect(b.naveed.net).toBe(115000);
    expect(b.gautam.net).toBe(30000);
    expect(b.ashok.net).toBe(-160000);
    expect(b.ande.net).toBe(-375000);
    expect(b.ayush.net).toBe(-645000);
    expect(balances.reduce((s, r) => s + r.net, 0)).toBe(0);
  });

  it('settles in the expected 5 payments', () => {
    const name = (id) => trip.participants.find((p) => p.id === id).name;
    expect(settleUp(balances).map((t) => `${name(t.from)}->${name(t.to)} ${t.amount / 100}`)).toEqual([
      'ayush->priya 6450',
      'ande->priya 3750',
      'ashok->naveed 1150',
      'ashok->gautam 300',
      'ashok->priya 150',
    ]);
  });
});

describe('keyword stickers', () => {
  it('maps the demo titles to the right stickers', () => {
    expect(trip.expenses.map((e) => keywordSticker(e.description)?.kind)).toEqual(['hotel', 'rickshaw', 'plate', 'diver', 'cart', 'bike']);
  });

  it('understands Hinglish and plurals, and only whole words', () => {
    expect(keywordSticker('autowala ko diye')?.kind).toBe('rickshaw');
    expect(keywordSticker('Daaru night')?.kind).toBe('beer');
    expect(keywordSticker('kulhad chai')?.kind).toBe('chai');
    expect(keywordSticker('Petrol tanki full')?.kind).toBe('fuel');
    expect(keywordSticker('2 bikes')?.kind).toBe('bike');
    expect(keywordSticker('Sabzi + kirana')?.kind).toBe('cart');
    expect(keywordSticker('Pool entry')?.kind).toBe('waves');
    expect(keywordSticker('scab')).toBeNull();
    expect(keywordSticker('Random thing')).toBeNull();
  });
});

describe('AI classifier layer', () => {
  it('parses JSON wrapped in code fences and prose', () => {
    const r = parseClassifierJson('Sure!\n```json\n{"emoji":"🪂","category":"paragliding","scene":"mountain","caption":"Udd gaye paise"}\n```');
    expect(r).toEqual({ emoji: '🪂', category: 'paragliding', scene: 'mountain', caption: 'Udd gaye paise' });
    expect(parseClassifierJson('no json here')).toBeNull();
    expect(parseClassifierJson('{"scene":"space"}').scene).toBe('misc');
  });

  it('prefers our own SVG sticker when the category matches one', () => {
    expect(stickerFromAi({ emoji: '🛺', category: 'taxi', scene: 'transport', caption: null }, 'x').kind).toBe('rickshaw');
    expect(stickerFromAi({ emoji: '🪂', category: 'paragliding', scene: 'mountain', caption: 'c' }, 'x')).toMatchObject({ kind: 'emoji', emoji: '🪂' });
  });

  it('builds the requested Anthropic request', () => {
    expect(buildAnthropicRequest('x')).toMatchObject({ model: 'claude-sonnet-4-6', max_tokens: 1000 });
  });

  it('calls the endpoint once per title, caches, and falls back offline', async () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return { ok: true, json: async () => ({ text: '{"emoji":"🪂","category":"paragliding","scene":"mountain","caption":"Udd gaye"}' }) };
    };
    const c = createClassifier({ endpoint: '/api/classify', fetchImpl, storage });
    const [a, b] = await Promise.all([c.classify('Paragliding'), c.classify('paragliding ')]);
    expect(a.emoji).toBe('🪂');
    expect(b).toEqual(a);
    expect(calls).toBe(1);
    expect(c.peek('PARAGLIDING').emoji).toBe('🪂');
    // Keyword titles never hit the network.
    expect((await c.classify('Hotel')).kind).toBe('hotel');
    expect(calls).toBe(1);
    // A fresh classifier reads the persisted cache.
    expect(createClassifier({ endpoint: '', storage }).peek('paragliding').emoji).toBe('🪂');

    const offline = createClassifier({ endpoint: '/api/classify', fetchImpl: async () => { throw new Error('offline'); }, storage: { getItem: () => null, setItem() {} } });
    expect((await offline.classify('Mystery')).kind).toBe('pin');
    const none = createClassifier({ endpoint: '', storage: { getItem: () => null, setItem() {} } });
    expect((await none.classify('Mystery')).kind).toBe('pin');
  });
});

describe('microcopy', () => {
  const money = (v) => formatMoney(v, '₹');
  it('writes data-specific lines', () => {
    expect(stopQuip({ id: 'x', payer: 'ayush', description: 'Bike', owesCount: 2, payerRunning: -645000, isBank: false, isBiggest: false, aiCaption: null, money })).toBe(
      'ayush paid for bike and still owes ₹6,450 💀',
    );
    expect(stopQuip({ id: 'x', payer: 'priya', description: 'Hotel', owesCount: 5, payerRunning: 1500000, isBank: true, isBiggest: true, aiCaption: null, money })).toBe(
      'priya is running Bank of Priya 🏦',
    );
    expect(personLine('ande', 300000, 0, money)).toMatch(/Suspiciously/);
  });

  it('wraps text into at most two lines', () => {
    expect(wrapText('one two three four five six', 9, 2)).toEqual(['one two', 'three…']);
    expect(wrapText('short', 20)).toEqual(['short']);
  });

  it('awards badges', () => {
    const balances = computeBalances(trip.participants, trip.expenses);
    const s = settleUp(balances);
    const badges = tripBadges(balances, s, {});
    expect(badges.find((b) => b.id === 'bank').label).toBe('Bank of Priya');
    expect(badges.some((b) => b.id.startsWith('ghost'))).toBe(false);
    expect(badges.find((b) => b.id === 'late').personId).toBe(nameId.ashok);
    const done = Object.fromEntries(s.map((t, i) => [settleKey(t), `2026-10-0${i + 1}T00:00:00Z`]));
    done[settleKey(s[1])] = '2026-10-09T00:00:00Z'; // ande settled last
    expect(tripBadges(balances, s, done).find((b) => b.id === 'late').personId).toBe(nameId.ande);
  });
});

describe('playback timeline', () => {
  const s = buildSchedule(3, { travel: 100, dwell: 50, final: 200 });
  const lengths = [0, 10, 20, 30, 60];
  const linear = (x) => x;

  it('schedules arrivals and total', () => {
    expect(s.arrivals).toEqual([100, 250, 400]);
    expect(s.total).toBe(650);
    expect([0, 99, 100, 260, 649].map((t) => reachedAt(t, s))).toEqual([0, 0, 1, 2, 3]);
  });

  it('parks at stops during the dwell and ends at camp', () => {
    expect(lengthAt(50, s, lengths, linear)).toBe(5);
    expect(lengthAt(120, s, lengths, linear)).toBe(10);
    expect(lengthAt(650, s, lengths, linear)).toBe(60);
    expect(legAt(550, s)).toEqual({ leg: 3, frac: 0.5 }); // final leg runs 450 -> 650
  });

  it('steps without travel under reduced motion', () => {
    const r = buildSchedule(2, REDUCED_TIMING);
    expect(lengthAt(1, r, [0, 10, 20, 30], linear)).toBe(10);
  });

  it('matches CSS cubic-bezier endpoints and overshoots for the pop', () => {
    const pop = cubicBezier(0.34, 1.56, 0.64, 1);
    expect(pop(0)).toBe(0);
    expect(pop(1)).toBe(1);
    expect(pop(0.5)).toBeGreaterThan(1);
  });
});

describe('trail layout', () => {
  const stops = trip.expenses.map((e, i) => ({
    id: e.id, amount: e.amount, day: i < 3 ? 1 : i < 5 ? 2 : 3, newDay: [0, 3, 5].includes(i),
    title: e.description, caption: 'a caption that is fairly long for wrapping', debtCount: 3, owesLabel: '3 people owe priya',
  }));
  const l = layoutTrail(stops, { seed: 'demo' });

  it('scales sticker size with the amount', () => {
    expect(stickerSize(1800000, 1800000)).toBe(84);
    expect(stickerSize(0, 1800000)).toBe(50);
    expect(l.stops[0].size).toBeGreaterThan(l.stops[5].size + 15);
  });

  it('alternates sides, never overlaps stops, and fits the width', () => {
    for (let i = 0; i < l.stops.length; i++) {
      const s = l.stops[i];
      expect(s.side).toBe(i % 2 ? -1 : 1);
      expect(s.x - s.size / 2).toBeGreaterThanOrEqual(0);
      expect(s.x + s.size / 2).toBeLessThanOrEqual(l.width);
      if (i) expect(s.top).toBeGreaterThan(l.stops[i - 1].bottom);
    }
    expect(new Set(l.stops.map((s) => s.tilt)).size).toBeGreaterThan(3);
    expect(l.segments).toHaveLength(stops.length + 1);
    expect(l.days.map((d) => d.day)).toEqual([1, 2, 3]);
  });

  it('is deterministic for the same seed', () => {
    expect(layoutTrail(stops, { seed: 'demo' })).toEqual(l);
  });
});

describe('fitLabel', () => {
  it('returns the full text when it fits', () => {
    expect(fitLabel('Hotel', 100)).toBe('Hotel');
    expect(fitLabel('abcde', 50, 10)).toBe('abcde');
  });
  it('truncates with an ellipsis and trims trailing spaces', () => {
    expect(fitLabel('abcdefghij', 50, 10)).toBe('abcd…');
    expect(fitLabel('abc defghij', 50, 10)).toBe('abc…');
    const out = fitLabel('Scuba diving at Havelock', 80);
    expect(out.endsWith('…')).toBe(true);
    expect([...out].length * 7.2).toBeLessThanOrEqual(80);
  });
  it('never splits an emoji surrogate pair', () => {
    const out = fitLabel('🪂🪂🪂🪂🪂', 30, 10);
    expect(out).toBe('🪂🪂…');
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
  it('returns just an ellipsis when width is smaller than one char', () => {
    expect(fitLabel('Hello', 3)).toBe('…');
    expect(fitLabel('Hello', 0)).toBe('…');
  });
});
