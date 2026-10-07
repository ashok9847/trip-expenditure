/**
 * Settlement: suggest the fewest transfers that bring every net balance to zero.
 *
 * Finding the true minimum is NP-hard in general. The minimum equals
 * (number of people with non-zero balance) - (max number of disjoint zero-sum groups),
 * because a zero-sum group of m people can always be settled with m-1 transfers
 * and never with fewer. For groups up to EXACT_LIMIT people we find that maximum
 * partition exactly with an O(2^n * n) bitmask DP; above that we fall back to the
 * greedy "largest debtor pays largest creditor" heuristic (at most n-1 transfers).
 */

export const EXACT_LIMIT = 15;

/**
 * @param {{ id: string, net: number }[]} balances integer minor units, must sum to 0
 * @returns {{ from: string, to: string, amount: number }[]}
 */
export function settleUp(balances) {
  const people = balances.filter((b) => b.net !== 0).map((b) => ({ id: b.id, net: b.net }));
  if (people.length === 0) return [];

  const total = people.reduce((s, p) => s + p.net, 0);
  if (total !== 0) {
    throw new Error(`Balances must sum to zero (got ${total}).`);
  }

  const groups = people.length <= EXACT_LIMIT ? partitionIntoZeroSumGroups(people) : [people];
  return groups.flatMap(greedySettle);
}

/**
 * Split people into the maximum number of disjoint groups whose balances each sum to zero.
 * dp[mask] = max over orderings of `mask` of the number of zero-sum prefixes.
 * @param {{ id: string, net: number }[]} people
 */
export function partitionIntoZeroSumGroups(people) {
  const n = people.length;
  const size = 1 << n;
  const full = size - 1;
  const sum = new Float64Array(size); // exact for integers up to 2^53
  const dp = new Int8Array(size);

  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask;
    sum[mask] = sum[mask ^ low] + people[31 - Math.clz32(low)].net;
  }

  for (let mask = 1; mask < size; mask++) {
    let best = 0;
    for (let i = 0; i < n; i++) {
      const bit = 1 << i;
      if (mask & bit && dp[mask ^ bit] > best) best = dp[mask ^ bit];
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
  }

  // Backtrack: peel people off the end of an optimal ordering; every time the
  // remaining set sums to zero, the peeled-off people form a complete group.
  const groups = [];
  let current = [];
  let mask = full;
  while (mask) {
    const bonus = sum[mask] === 0 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const bit = 1 << i;
      if (mask & bit && dp[mask ^ bit] + bonus === dp[mask]) {
        current.push(people[i]);
        mask ^= bit;
        break;
      }
    }
    if (sum[mask] === 0) {
      groups.push(current);
      current = [];
    }
  }
  return groups;
}

/**
 * Greedy settle within one zero-sum group: the biggest debtor pays the biggest
 * creditor as much as possible. Each transfer zeroes at least one person.
 * Ties are broken by original order so output is deterministic.
 */
function greedySettle(group) {
  const people = group.map((p) => ({ ...p }));
  const transfers = [];

  for (;;) {
    let creditor = null;
    let debtor = null;
    for (const p of people) {
      if (p.net > 0 && (!creditor || p.net > creditor.net)) creditor = p;
      if (p.net < 0 && (!debtor || p.net < debtor.net)) debtor = p;
    }
    if (!creditor || !debtor) break;

    const amount = Math.min(creditor.net, -debtor.net);
    transfers.push({ from: debtor.id, to: creditor.id, amount });
    creditor.net -= amount;
    debtor.net += amount;
  }
  return transfers;
}
