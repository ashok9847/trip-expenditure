import { describe, it, expect } from 'vitest';
import { settleUp, partitionIntoZeroSumGroups, EXACT_LIMIT } from '../utils/settlement.js';
import { computeBalances } from '../utils/balances.js';

/** Apply transfers and return the remaining nets (should all be zero). */
function applyTransfers(balances, transfers) {
  const nets = Object.fromEntries(balances.map((b) => [b.id, b.net]));
  for (const t of transfers) {
    expect(t.amount).toBeGreaterThan(0);
    expect(Number.isInteger(t.amount)).toBe(true);
    nets[t.from] += t.amount;
    nets[t.to] -= t.amount;
  }
  return nets;
}

const allZero = (nets) => Object.values(nets).every((v) => v === 0);
const b = (id, net) => ({ id, net });

describe('settleUp', () => {
  it('returns nothing when everyone is settled', () => {
    expect(settleUp([])).toEqual([]);
    expect(settleUp([b('a', 0), b('b', 0)])).toEqual([]);
  });

  it('settles a simple two-person debt', () => {
    expect(settleUp([b('ravi', 30000), b('kiran', -30000)])).toEqual([{ from: 'kiran', to: 'ravi', amount: 30000 }]);
  });

  it('settles one creditor and several debtors with n-1 transfers', () => {
    const balances = [b('ravi', 37500), b('kiran', -12500), b('anil', -12500), b('sai', -12500)];
    const t = settleUp(balances);
    expect(t).toHaveLength(3);
    expect(t.every((x) => x.to === 'ravi' && x.amount === 12500)).toBe(true);
    expect(allZero(applyTransfers(balances, t))).toBe(true);
  });

  it('finds the true minimum where greedy would use more transfers', () => {
    // Greedy (largest-first) gives 4 transfers here; optimal is 3 because
    // {a:+5, d:-5} and {b:+4, c:+3, e:-7} are independent zero-sum groups.
    const balances = [b('a', 5), b('b', 4), b('c', 3), b('d', -5), b('e', -7)];
    const t = settleUp(balances);
    expect(t).toHaveLength(3);
    expect(allZero(applyTransfers(balances, t))).toBe(true);
  });

  it('pairs exactly matching debts', () => {
    const balances = [b('a', 100), b('b', 200), b('c', -200), b('d', -100)];
    const t = settleUp(balances);
    expect(t).toHaveLength(2);
    expect(t).toContainEqual({ from: 'c', to: 'b', amount: 200 });
    expect(t).toContainEqual({ from: 'd', to: 'a', amount: 100 });
  });

  it('handles 1-minor-unit rounding leftovers', () => {
    const people = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ];
    const expenses = [
      { id: '1', amount: 10000, paidBy: 'a', participantIds: ['a', 'b', 'c'], splitMode: 'equal' },
      { id: '2', amount: 1, paidBy: 'b', participantIds: ['a', 'b', 'c'], splitMode: 'equal' },
    ];
    const balances = computeBalances(people, expenses);
    const t = settleUp(balances);
    expect(allZero(applyTransfers(balances, t))).toBe(true);
    // a: paid 10000, share 3334 + 1 = 3335 -> net +6665; b: -3332; c: -3333
    expect(t).toEqual([
      { from: 'c', to: 'a', amount: 3333 },
      { from: 'b', to: 'a', amount: 3332 },
    ]);
  });

  it('throws when balances do not sum to zero', () => {
    expect(() => settleUp([b('a', 10), b('b', -9)])).toThrow();
  });

  it('never needs more than n-1 transfers and always clears every balance (random)', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let round = 0; round < 200; round++) {
      const n = 2 + Math.floor(rand() * 9);
      const balances = [];
      let running = 0;
      for (let i = 0; i < n - 1; i++) {
        const v = Math.floor(rand() * 20001) - 10000;
        balances.push(b(`p${i}`, v));
        running += v;
      }
      balances.push(b(`p${n - 1}`, -running));
      const t = settleUp(balances);
      const nonZero = balances.filter((x) => x.net !== 0).length;
      expect(t.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));
      expect(allZero(applyTransfers(balances, t))).toBe(true);
    }
  });

  it('falls back to greedy for very large groups and still clears balances', () => {
    const n = EXACT_LIMIT + 5;
    const balances = Array.from({ length: n }, (_, i) => b(`p${i}`, i < n - 1 ? 100 + i : 0));
    balances[n - 1].net = -balances.slice(0, n - 1).reduce((s, x) => s + x.net, 0);
    const t = settleUp(balances);
    expect(t).toHaveLength(n - 1);
    expect(allZero(applyTransfers(balances, t))).toBe(true);
  });
});

describe('partitionIntoZeroSumGroups', () => {
  it('returns groups that each sum to zero and cover everyone', () => {
    const people = [b('a', 5), b('b', 4), b('c', 3), b('d', -5), b('e', -7)];
    const groups = partitionIntoZeroSumGroups(people);
    expect(groups).toHaveLength(2);
    for (const g of groups) expect(g.reduce((s, p) => s + p.net, 0)).toBe(0);
    expect(groups.flat().map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
