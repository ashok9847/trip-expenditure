import { describe, it, expect } from 'vitest';
import { makeDemoTrip } from '../utils/demoTrip.js';
import { computeBalances } from '../utils/balances.js';
import { settleUp } from '../utils/settlement.js';
import { computeShares } from '../utils/splits.js';

// Deterministic ids so tests are stable.
function seqId() {
  let n = 0;
  return () => `id${++n}`;
}

const byName = (trip) => Object.fromEntries(trip.participants.map((p) => [p.name, p.id]));

describe('demo trip', () => {
  const trip = makeDemoTrip(seqId());
  const balances = computeBalances(trip.participants, trip.expenses);
  const netByName = Object.fromEntries(balances.map((b) => [b.name, b.net]));

  it('produces the documented nets (paise)', () => {
    expect(netByName).toEqual({
      priya: 10350 * 100,
      naveed: 1150 * 100,
      gautam: 300 * 100,
      ashok: -1600 * 100,
      ande: -3750 * 100,
      ayush: -6450 * 100,
    });
  });

  it('nets sum to zero', () => {
    expect(balances.reduce((s, b) => s + b.net, 0)).toBe(0);
  });

  it("each expense's shares sum to its amount", () => {
    for (const e of trip.expenses) {
      const shares = computeShares(e);
      expect(Object.values(shares).reduce((s, v) => s + v, 0)).toBe(e.amount);
    }
  });

  it('settleUp returns exactly 5 payments that clear all balances', () => {
    const transfers = settleUp(balances);
    expect(transfers).toHaveLength(5);
    const nets = Object.fromEntries(balances.map((b) => [b.id, b.net]));
    for (const t of transfers) {
      expect(t.amount).toBeGreaterThan(0);
      nets[t.from] += t.amount;
      nets[t.to] -= t.amount;
    }
    expect(Object.values(nets).every((v) => v === 0)).toBe(true);
  });

  it('uses the six named participants', () => {
    expect(Object.keys(byName(trip)).sort()).toEqual(['ande', 'ashok', 'ayush', 'gautam', 'naveed', 'priya']);
  });
});
