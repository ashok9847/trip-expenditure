// Built-in demo trip (6 friends in Goa). Amounts in paise.
import { createId } from './id.js';

const CATEGORY = { Hotel: 'Stay', 'Airport cab': 'Travel', Dinner: 'Food', Scuba: 'Activities', Groceries: 'Groceries', 'Bike rental': 'Travel' };

const at = (day, h, m = 0) => new Date(2026, 8, 26 + day, h, m).toISOString();

export function makeDemoTrip(makeId = createId) {
  const names = ['ashok', 'gautam', 'priya', 'naveed', 'ayush', 'ande'];
  const p = Object.fromEntries(names.map((n) => [n, makeId()]));
  const all = names.map((n) => p[n]);
  const ids = (...ns) => ns.map((n) => p[n]);
  const e = (description, rupees, payer, participantIds, dateTime, custom) => ({
    id: makeId(),
    description,
    amount: rupees * 100,
    paidBy: p[payer],
    participantIds,
    dateTime,
    splitMode: custom ? 'custom' : 'equal',
    customShares: custom ? Object.fromEntries(Object.entries(custom).map(([n, v]) => [p[n], v * 100])) : null,
    receiptId: null,
    category: CATEGORY[description] ?? null,
  });
  return {
    id: makeId(),
    name: 'Goa, finally',
    startDate: '2026-09-27',
    endDate: '2026-09-29',
    createdAt: new Date().toISOString(),
    lastPayerId: p.ayush,
    settled: {},
    participants: names.map((n) => ({ id: p[n], name: n, photo: null, upi: null, qr: null })),
    expenses: [
      e('Hotel', 18000, 'priya', all, at(1, 13)),
      e('Airport cab', 4500, 'ashok', ids('ashok', 'gautam', 'priya', 'naveed', 'ayush'), at(1, 15)),
      e('Dinner', 7200, 'gautam', all, at(1, 21)),
      e('Scuba', 9000, 'naveed', ids('naveed', 'ayush', 'ande', 'priya'), at(2, 10)),
      e('Groceries', 3000, 'ande', all, at(2, 18), { ashok: 200, gautam: 1000, priya: 300, naveed: 500, ayush: 700, ande: 300 }),
      e('Bike rental', 2400, 'ayush', ids('ashok', 'gautam', 'ayush'), at(3, 9)),
    ],
  };
}
