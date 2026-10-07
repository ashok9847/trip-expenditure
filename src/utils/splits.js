/**
 * Split an integer total equally among participant ids.
 * The remainder (in minor units) goes one unit each to the first participants
 * in the given order, so shares always sum exactly to the total.
 * @param {number} total integer minor units
 * @param {string[]} ids
 * @returns {Record<string, number>}
 */
export function equalSplit(total, ids) {
  const shares = {};
  const n = ids.length;
  if (n === 0) return shares;
  const base = Math.floor(total / n);
  let remainder = total - base * n;
  for (const id of ids) {
    shares[id] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }
  return shares;
}

/**
 * Describe an equal split for the live preview.
 * @returns {{ count: number, base: number, extraCount: number }}
 *   base = amount most people pay; extraCount people pay base + 1 minor unit.
 */
export function describeEqualSplit(total, count) {
  if (count <= 0) return { count: 0, base: 0, extraCount: 0 };
  const base = Math.floor(total / count);
  return { count, base, extraCount: total - base * count };
}

/**
 * Compute each participant's share of an expense.
 * @param {{ amount: number, splitMode: 'equal'|'custom', participantIds: string[], customShares?: Record<string, number>|null }} expense
 * @returns {Record<string, number>}
 */
export function computeShares(expense) {
  if (expense.splitMode === 'custom' && expense.customShares) {
    const shares = {};
    for (const id of expense.participantIds) {
      shares[id] = expense.customShares[id] ?? 0;
    }
    return shares;
  }
  return equalSplit(expense.amount, expense.participantIds);
}

/**
 * Validate a custom split.
 * @param {number} total
 * @param {Record<string, number|null>} shares per-person minor units (null = invalid input)
 * @param {string[]} ids selected participant ids
 * @returns {{ valid: boolean, sum: number, difference: number, error: string|null }}
 *   difference = total - sum (positive: still to assign, negative: over-assigned)
 */
export function validateCustomSplit(total, shares, ids) {
  if (ids.length === 0) {
    return { valid: false, sum: 0, difference: total, error: 'Select at least one person.' };
  }
  let sum = 0;
  for (const id of ids) {
    const v = shares[id];
    if (v === null || v === undefined || !Number.isInteger(v) || v < 0) {
      return { valid: false, sum, difference: total - sum, error: 'Enter a valid amount for everyone selected.' };
    }
    sum += v;
  }
  const difference = total - sum;
  if (difference !== 0) {
    return {
      valid: false,
      sum,
      difference,
      error: difference > 0 ? 'Custom amounts are less than the total.' : 'Custom amounts exceed the total.',
    };
  }
  return { valid: true, sum, difference: 0, error: null };
}
