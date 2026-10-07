import { describe, it, expect } from 'vitest';
import { buildJourney, stopInvolves, personColor, PERSON_COLORS } from '../utils/journey.js';

const at = (d, h) => new Date(2026, 8, d, h).toISOString();
const trip = {
  participants: [
    { id: 'r', name: 'Ravi' },
    { id: 'k', name: 'Kiran' },
    { id: 'a', name: 'Anil' },
  ],
  expenses: [
    // listed out of order on purpose
    { id: '2', description: 'Cab', amount: 1000, paidBy: 'k', participantIds: ['k', 'a'], splitMode: 'equal', dateTime: at(29, 9) },
    { id: '1', description: 'Noodles', amount: 900, paidBy: 'r', participantIds: ['r', 'k', 'a'], splitMode: 'equal', dateTime: at(28, 20) },
    { id: '3', description: 'Gift', amount: 500, paidBy: 'a', participantIds: ['r'], splitMode: 'equal', dateTime: at(29, 12) },
    {
      id: '4', description: 'Hotel', amount: 1000, paidBy: 'r', participantIds: ['r', 'k'], splitMode: 'custom',
      customShares: { r: 1000, k: 0 }, dateTime: at(29, 14),
    },
  ],
};

describe('buildJourney', () => {
  const { stops, settlements, finalBalances } = buildJourney(trip);

  it('orders stops chronologically and numbers days', () => {
    expect(stops.map((s) => s.id)).toEqual(['1', '2', '3', '4']);
    expect(stops.map((s) => s.day)).toEqual([1, 2, 2, 2]);
    expect(stops.map((s) => s.newDay)).toEqual([true, true, false, false]);
  });

  it('lists who owes the payer for each payment, excluding the payer', () => {
    expect(stops[0].debts).toEqual([
      { from: 'k', to: 'r', amount: 300 },
      { from: 'a', to: 'r', amount: 300 },
    ]);
    expect(stops[0].payerShare).toBe(300);
  });

  it('handles paying for someone else entirely (payer not in the split)', () => {
    expect(stops[2].payerShare).toBe(0);
    expect(stops[2].debts).toEqual([{ from: 'r', to: 'a', amount: 500 }]);
  });

  it('skips people whose custom share is zero', () => {
    expect(stops[3].debts).toEqual([]);
    expect(stops[3].payerShare).toBe(1000);
  });

  it('tracks running balances that always sum to zero and end at the final balances', () => {
    for (const s of stops) expect(Object.values(s.running).reduce((a, b) => a + b, 0)).toBe(0);
    expect(stops[0].running).toEqual({ r: 600, k: -300, a: -300 });
    const last = stops[stops.length - 1].running;
    for (const b of finalBalances) expect(last[b.id]).toBe(b.net);
  });

  it('ends with settle-up payments that clear the final balances', () => {
    const nets = Object.fromEntries(finalBalances.map((b) => [b.id, b.net]));
    for (const t of settlements) {
      nets[t.from] += t.amount;
      nets[t.to] -= t.amount;
    }
    expect(Object.values(nets).every((v) => v === 0)).toBe(true);
  });

  it('filters stops by person', () => {
    expect(stops.filter((s) => stopInvolves(s, 'a')).map((s) => s.id)).toEqual(['1', '2', '3']);
    expect(stops.filter((s) => stopInvolves(s, 'k')).map((s) => s.id)).toEqual(['1', '2']);
  });

  it('handles an empty trip', () => {
    expect(buildJourney({ ...trip, expenses: [] })).toMatchObject({ stops: [], settlements: [] });
  });
});

describe('personColor', () => {
  it('is stable per participant position', () => {
    expect(personColor(trip, 'r')).toBe(PERSON_COLORS[0]);
    expect(personColor(trip, 'a')).toBe(PERSON_COLORS[2]);
  });
});
