import { computeShares } from './splits.js';

/**
 * Compute paid / share / net for every participant.
 * Net = paid - share. Positive: they get money back. Negative: they owe.
 * Because every value is an integer and shares sum to each expense amount,
 * the nets always sum to exactly zero.
 * @param {{id: string, name: string}[]} participants
 * @param {Array} expenses
 * @returns {{ id: string, name: string, paid: number, share: number, net: number }[]}
 */
export function computeBalances(participants, expenses) {
  const map = new Map(participants.map((p) => [p.id, { id: p.id, name: p.name, paid: 0, share: 0, net: 0 }]));

  for (const exp of expenses) {
    const payer = map.get(exp.paidBy);
    if (payer) payer.paid += exp.amount;
    const shares = computeShares(exp);
    for (const [id, share] of Object.entries(shares)) {
      const row = map.get(id);
      if (row) row.share += share;
    }
  }

  for (const row of map.values()) row.net = row.paid - row.share;
  return [...map.values()];
}

/** Total of all expense amounts (minor units). */
export function totalExpenditure(expenses) {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/** Number of expenses a participant is involved in (as payer or in the split). */
export function expenseCountFor(participantId, expenses) {
  return expenses.filter((e) => e.paidBy === participantId || e.participantIds.includes(participantId)).length;
}
