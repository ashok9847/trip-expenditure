import { describe, it, expect } from 'vitest';
import { equalSplit, computeShares, validateCustomSplit, describeEqualSplit } from '../utils/splits.js';

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

describe('equalSplit', () => {
  it('splits evenly when divisible', () => {
    expect(equalSplit(40000, ['a', 'b', 'c', 'd'])).toEqual({ a: 10000, b: 10000, c: 10000, d: 10000 });
  });

  it('distributes the remainder one minor unit at a time to the first people', () => {
    // ₹100 / 3 = 33.34, 33.33, 33.33
    expect(equalSplit(10000, ['a', 'b', 'c'])).toEqual({ a: 3334, b: 3333, c: 3333 });
    // 0.05 / 3 -> 2, 2, 1
    expect(equalSplit(5, ['a', 'b', 'c'])).toEqual({ a: 2, b: 2, c: 1 });
  });

  it('always sums to the total', () => {
    for (let total = 0; total < 500; total += 7) {
      for (let n = 1; n <= 9; n++) {
        const ids = Array.from({ length: n }, (_, i) => `p${i}`);
        expect(sum(equalSplit(total, ids))).toBe(total);
      }
    }
  });

  it('handles a single person and an empty list', () => {
    expect(equalSplit(999, ['solo'])).toEqual({ solo: 999 });
    expect(equalSplit(999, [])).toEqual({});
  });

  it('handles amounts smaller than the number of people', () => {
    expect(equalSplit(2, ['a', 'b', 'c'])).toEqual({ a: 1, b: 1, c: 0 });
  });
});

describe('describeEqualSplit', () => {
  it('reports base share and how many pay one extra unit', () => {
    expect(describeEqualSplit(10000, 3)).toEqual({ count: 3, base: 3333, extraCount: 1 });
    expect(describeEqualSplit(50000, 4)).toEqual({ count: 4, base: 12500, extraCount: 0 });
    expect(describeEqualSplit(50000, 0)).toEqual({ count: 0, base: 0, extraCount: 0 });
  });
});

describe('computeShares', () => {
  it('uses equal split by default', () => {
    expect(computeShares({ amount: 900, splitMode: 'equal', participantIds: ['a', 'b', 'c'] })).toEqual({
      a: 300,
      b: 300,
      c: 300,
    });
  });

  it('uses custom shares when in custom mode', () => {
    const exp = {
      amount: 1000,
      splitMode: 'custom',
      participantIds: ['a', 'b'],
      customShares: { a: 700, b: 300, stale: 999 },
    };
    expect(computeShares(exp)).toEqual({ a: 700, b: 300 });
  });
});

describe('validateCustomSplit', () => {
  it('accepts amounts that add up to the total', () => {
    expect(validateCustomSplit(1000, { a: 600, b: 400 }, ['a', 'b']).valid).toBe(true);
  });

  it('allows zero for a selected person as long as the total matches', () => {
    expect(validateCustomSplit(1000, { a: 1000, b: 0 }, ['a', 'b']).valid).toBe(true);
  });

  it('reports under- and over-assignment', () => {
    const under = validateCustomSplit(1000, { a: 600, b: 300 }, ['a', 'b']);
    expect(under.valid).toBe(false);
    expect(under.difference).toBe(100);
    const over = validateCustomSplit(1000, { a: 600, b: 500 }, ['a', 'b']);
    expect(over.valid).toBe(false);
    expect(over.difference).toBe(-100);
  });

  it('rejects missing/invalid entries and empty selection', () => {
    expect(validateCustomSplit(1000, { a: 1000, b: null }, ['a', 'b']).valid).toBe(false);
    expect(validateCustomSplit(1000, { a: 1000 }, ['a', 'b']).valid).toBe(false);
    expect(validateCustomSplit(1000, {}, []).valid).toBe(false);
  });

  it('ignores amounts for people who are not selected', () => {
    expect(validateCustomSplit(1000, { a: 1000, b: 500 }, ['a']).valid).toBe(true);
  });
});
