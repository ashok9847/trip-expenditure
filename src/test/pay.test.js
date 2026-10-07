import { describe, it, expect } from 'vitest';
import { toUpiAmount, buildUpiLink, pruneSettled } from '../utils/pay.js';
import { settleKey } from '../utils/copy.js';

// Parse the query part of a upi:// link into decoded params.
const params = (url) => new URLSearchParams(url.slice(url.indexOf('?') + 1));

describe('toUpiAmount', () => {
  it('formats minor units with exactly two decimals', () => {
    expect(toUpiAmount(125050)).toBe('1250.50');
    expect(toUpiAmount(100)).toBe('1.00');
    expect(toUpiAmount(1)).toBe('0.01');
    expect(toUpiAmount(123456789)).toBe('1234567.89');
  });

  it('has no symbol or separators', () => {
    expect(toUpiAmount(100000000)).toMatch(/^\d+\.\d{2}$/);
  });
});

describe('buildUpiLink', () => {
  const to = { upi: 'ravi@okaxis', name: 'Ravi Kumar' };

  it('builds pa, pn, am, cu and tn', () => {
    const url = buildUpiLink(to, 125050, 'Goa');
    expect(url.startsWith('upi://pay?')).toBe(true);
    const p = params(url);
    expect(p.get('pa')).toBe('ravi@okaxis');
    expect(p.get('pn')).toBe('Ravi Kumar');
    expect(p.get('am')).toBe('1250.50');
    expect(p.get('cu')).toBe('INR');
    expect(p.get('tn')).toBe('TripSplit: Goa');
  });

  it('omits tn without a trip name', () => {
    expect(params(buildUpiLink(to, 100)).has('tn')).toBe(false);
    expect(params(buildUpiLink(to, 100, '')).has('tn')).toBe(false);
  });

  it('encodes unicode and reserved characters in the name', () => {
    const p = params(buildUpiLink({ upi: 'a@b', name: 'Émile & Co = 🙂' }, 100));
    expect(p.get('pn')).toBe('Émile & Co = 🙂');
  });

  it('caps the note at 50 characters without splitting emoji', () => {
    const tn = params(buildUpiLink(to, 100, `${'x'.repeat(38)}🙂🙂🙂`)).get('tn');
    expect(Array.from(tn).length).toBe(50);
    expect(tn.startsWith('TripSplit: ')).toBe(true);
    expect(params(buildUpiLink(to, 100, 'y'.repeat(200))).get('tn')).toHaveLength(50);
  });
});

describe('pruneSettled', () => {
  const a = { from: 'p1', to: 'p2', amount: 500 };
  const b = { from: 'p3', to: 'p2', amount: 1250 };

  it('keeps only marks for current settlements with values unchanged', () => {
    const settled = {
      [settleKey(a)]: '2024-01-01T00:00:00.000Z',
      [settleKey(b)]: '2024-01-02T00:00:00.000Z',
      'p1|p2|499': '2024-01-03T00:00:00.000Z',
    };
    expect(pruneSettled(settled, [a])).toEqual({ [settleKey(a)]: '2024-01-01T00:00:00.000Z' });
  });

  it('is idempotent and handles empty inputs', () => {
    const settled = { [settleKey(a)]: 't1', 'x|y|1': 't2' };
    const once = pruneSettled(settled, [a, b]);
    expect(pruneSettled(once, [a, b])).toEqual(once);
    expect(pruneSettled({}, [a])).toEqual({});
    expect(pruneSettled(settled, [])).toEqual({});
  });
});
