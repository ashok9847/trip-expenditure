import { describe, it, expect } from 'vitest';
import { parseAmount, formatMoney, toMajorString } from '../utils/money.js';

describe('parseAmount', () => {
  it('parses whole and decimal amounts into minor units', () => {
    expect(parseAmount('500')).toBe(50000);
    expect(parseAmount('12.5')).toBe(1250);
    expect(parseAmount('12.05')).toBe(1205);
    expect(parseAmount('0.1')).toBe(10);
    expect(parseAmount('.75')).toBe(75);
    expect(parseAmount('10.')).toBe(1000);
    expect(parseAmount(' 1,250.75 ')).toBe(125075);
  });

  it('avoids floating point drift', () => {
    expect(parseAmount('0.29')).toBe(29);
    expect(parseAmount('1.15')).toBe(115);
  });

  it('rejects invalid input', () => {
    for (const bad of ['', '  ', 'abc', '-5', '1.234', '1.2.3', '1e3', null, undefined]) {
      expect(parseAmount(bad)).toBeNull();
    }
  });

  it('rejects absurdly large amounts', () => {
    expect(parseAmount('999999999999')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats with symbol and only shows decimals when needed', () => {
    expect(formatMoney(50000, '₹')).toBe('₹500');
    expect(formatMoney(50050, '₹')).toBe('₹500.50');
    expect(formatMoney(-30000, '₹')).toBe('-₹300');
    expect(formatMoney(12345678, '₹')).toBe('₹1,23,456.78');
    expect(formatMoney(12345678, '$')).toBe('$123,456.78');
  });
});

describe('toMajorString', () => {
  it('round-trips with parseAmount', () => {
    for (const v of [0, 1, 99, 100, 1205, 50000, 123456]) {
      expect(parseAmount(toMajorString(v))).toBe(v);
    }
  });
});
