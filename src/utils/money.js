// All money in TripSplit is stored as integer "minor units" (e.g. paise/cents)
// so arithmetic never suffers from floating-point drift.

export const MAX_AMOUNT = 100_000_000_00; // 10 crore / 100M in major units

const AMOUNT_RE = /^(\d+)(?:\.(\d{0,2}))?$|^\.(\d{1,2})$/;

/**
 * Parse user input like "500", "12.5", "1,250.75" into integer minor units.
 * Returns null when the input is not a valid non-negative amount with at most 2 decimals.
 * @param {string|number} input
 * @returns {number|null}
 */
export function parseAmount(input) {
  if (input === null || input === undefined) return null;
  const str = String(input).trim().replace(/[,\s]/g, '');
  if (str === '') return null;
  const m = AMOUNT_RE.exec(str);
  if (!m) return null;
  const whole = m[1] ?? '0';
  const frac = (m[2] ?? m[3] ?? '').padEnd(2, '0');
  const value = Number(whole) * 100 + Number(frac);
  if (!Number.isSafeInteger(value) || value > MAX_AMOUNT) return null;
  return value;
}

/**
 * Convert minor units back to an editable string ("1250" -> "12.50", "50000" -> "500").
 * @param {number} minor
 */
export function toMajorString(minor) {
  if (!Number.isFinite(minor)) return '';
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return frac === 0 ? `${sign}${whole}` : `${sign}${whole}.${String(frac).padStart(2, '0')}`;
}

/**
 * Format minor units for display, e.g. formatMoney(50050, '₹') -> "₹500.50".
 * Uses Indian digit grouping for ₹, international grouping otherwise.
 * @param {number} minor
 * @param {string} [symbol]
 */
export function formatMoney(minor, symbol = '₹') {
  const value = Math.round(minor || 0);
  const abs = Math.abs(value);
  const hasFraction = abs % 100 !== 0;
  const locale = symbol === '₹' ? 'en-IN' : 'en-US';
  const num = new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(abs / 100);
  return `${value < 0 ? '-' : ''}${symbol}${num}`;
}
