import { describe, it, expect } from 'vitest';
import { computeBalances, totalExpenditure, expenseCountFor } from '../utils/balances.js';

const people = [
  { id: 'ravi', name: 'Ravi' },
  { id: 'kiran', name: 'Kiran' },
  { id: 'anil', name: 'Anil' },
  { id: 'sai', name: 'Sai' },
  { id: 'meera', name: 'Meera' },
];

let seq = 0;
const exp = (amount, paidBy, participantIds, extra = {}) => ({
  id: `e${seq++}`,
  description: 'x',
  amount,
  paidBy,
  participantIds,
  splitMode: 'equal',
  customShares: null,
  dateTime: '2026-09-29T15:15:00.000Z',
  ...extra,
});

const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
const netSum = (rows) => rows.reduce((s, r) => s + r.net, 0);

describe('computeBalances', () => {
  it('returns zeros when there are no expenses', () => {
    const rows = computeBalances(people, []);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.paid === 0 && r.share === 0 && r.net === 0)).toBe(true);
  });

  it('handles the "4 of 5 ate noodles" case', () => {
    const rows = byId(computeBalances(people, [exp(50000, 'ravi', ['ravi', 'kiran', 'anil', 'sai'])]));
    expect(rows.ravi).toMatchObject({ paid: 50000, share: 12500, net: 37500 });
    expect(rows.kiran).toMatchObject({ paid: 0, share: 12500, net: -12500 });
    expect(rows.meera).toMatchObject({ paid: 0, share: 0, net: 0 });
  });

  it('handles uneven splits and keeps nets summing to zero', () => {
    const expenses = [exp(10000, 'ravi', ['ravi', 'kiran', 'anil']), exp(1001, 'kiran', ['kiran', 'anil', 'sai'])];
    const rows = computeBalances(people, expenses);
    const r = byId(rows);
    expect(r.ravi.share).toBe(3334);
    expect(r.kiran.share).toBe(3333 + 334);
    expect(r.anil.share).toBe(3333 + 334);
    expect(r.sai.share).toBe(333);
    expect(netSum(rows)).toBe(0);
  });

  it('handles a single-person expense (paid for themselves)', () => {
    const rows = byId(computeBalances(people, [exp(20000, 'anil', ['anil'])]));
    expect(rows.anil).toMatchObject({ paid: 20000, share: 20000, net: 0 });
  });

  it('handles a single-person expense paid on someone else’s behalf', () => {
    const rows = byId(computeBalances(people, [exp(20000, 'anil', ['sai'])]));
    expect(rows.anil.net).toBe(20000);
    expect(rows.sai.net).toBe(-20000);
  });

  it('handles custom splits', () => {
    const rows = byId(
      computeBalances(people, [
        exp(100000, 'meera', ['meera', 'ravi', 'kiran'], {
          splitMode: 'custom',
          customShares: { meera: 50000, ravi: 30000, kiran: 20000 },
        }),
      ]),
    );
    expect(rows.meera).toMatchObject({ paid: 100000, share: 50000, net: 50000 });
    expect(rows.ravi.net).toBe(-30000);
    expect(rows.kiran.net).toBe(-20000);
  });

  it('nets always sum to exactly zero over many random uneven expenses (rounding)', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const expenses = [];
    for (let i = 0; i < 500; i++) {
      const subset = people.filter(() => rand() > 0.4).map((p) => p.id);
      if (subset.length === 0) subset.push('ravi');
      expenses.push(exp(1 + Math.floor(rand() * 99999), people[Math.floor(rand() * 5)].id, subset));
    }
    const rows = computeBalances(people, expenses);
    expect(netSum(rows)).toBe(0);
    expect(rows.reduce((s, r) => s + r.share, 0)).toBe(totalExpenditure(expenses));
  });
});

describe('totalExpenditure / expenseCountFor', () => {
  it('sums amounts and counts involvement', () => {
    const expenses = [exp(100, 'ravi', ['kiran']), exp(250, 'anil', ['anil', 'ravi'])];
    expect(totalExpenditure(expenses)).toBe(350);
    expect(expenseCountFor('ravi', expenses)).toBe(2);
    expect(expenseCountFor('kiran', expenses)).toBe(1);
    expect(expenseCountFor('meera', expenses)).toBe(0);
  });
});
