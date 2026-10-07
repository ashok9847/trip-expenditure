// Pure logic for the "Payment journey": the trip replayed payment by payment,
// with who owes the payer for each one and the running balances afterwards.

import { computeShares } from './splits.js';
import { computeBalances } from './balances.js';
import { settleUp } from './settlement.js';
import { toLocalDateKey } from './dates.js';

/** Distinct colours for people (assigned by position in the trip). */
// Person colours come from the trail palette family (sunset, forest, river, marigold, and earthy relatives).
export const PERSON_COLORS = ['#D9483B', '#3E7D4F', '#2E86B0', '#C98A12', '#8B5E3C', '#B4466A', '#2F6F73', '#6B7A2E', '#E0763A', '#51507A'];

export const personColor = (trip, id) => {
  const i = trip.participants.findIndex((p) => p.id === id);
  return PERSON_COLORS[(i < 0 ? 0 : i) % PERSON_COLORS.length];
};

/**
 * @returns {{
 *   stops: Array<{
 *     id: string, index: number, day: number, newDay: boolean,
 *     payerId: string, amount: number, description: string,
 *     payerShare: number,                       // payer's own part (0 if not in split)
 *     debts: { from: string, to: string, amount: number }[],  // created by this payment
 *     running: Record<string, number>,          // everyone's net balance after this stop
 *   }>,
 *   settlements: { from: string, to: string, amount: number }[],
 *   finalBalances: ReturnType<typeof computeBalances>,
 * }}
 */
export function buildJourney(trip) {
  const sorted = [...trip.expenses].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  const running = Object.fromEntries(trip.participants.map((p) => [p.id, 0]));
  const order = trip.participants.map((p) => p.id);

  let day = 0;
  let lastKey = null;
  const stops = sorted.map((e, index) => {
    const key = toLocalDateKey(e.dateTime);
    const newDay = key !== lastKey;
    if (newDay) {
      day += 1;
      lastKey = key;
    }

    const shares = computeShares(e);
    if (e.paidBy in running) running[e.paidBy] += e.amount;
    for (const [id, share] of Object.entries(shares)) if (id in running) running[id] -= share;

    const debts = order
      .filter((id) => id !== e.paidBy && (shares[id] ?? 0) > 0)
      .map((id) => ({ from: id, to: e.paidBy, amount: shares[id] }));

    return {
      id: e.id,
      index,
      day,
      newDay,
      payerId: e.paidBy,
      amount: e.amount,
      description: e.description,
      payerShare: shares[e.paidBy] ?? 0,
      debts,
      running: { ...running },
    };
  });

  const finalBalances = computeBalances(trip.participants, trip.expenses);
  return { stops, settlements: settleUp(finalBalances), finalBalances };
}

/** Does a stop involve this person (as payer or as someone who owes)? */
export const stopInvolves = (stop, personId) =>
  stop.payerId === personId || stop.debts.some((d) => d.from === personId);
