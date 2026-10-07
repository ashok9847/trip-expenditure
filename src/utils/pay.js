// Settle-up payment helpers (UPI deep links, paid-mark pruning). Pure functions only.
import { settleKey } from './copy.js';

/** Minor units → rupees with exactly two decimals, no symbol/separators: 125050 → "1250.50", 100 → "1.00". */
export const toUpiAmount = (minor) => {
  const abs = Math.abs(Math.round(minor));
  return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};

/** upi://pay?pa=<upi>&pn=<name>&am=<rupees, 2dp>&cu=INR&tn=<note> */
export function buildUpiLink(to, amountMinor, tripName = '') {
  const enc = encodeURIComponent;
  let url = `upi://pay?pa=${enc(to.upi)}&pn=${enc(to.name)}&am=${toUpiAmount(amountMinor)}&cu=INR`;
  if (tripName) {
    // Slice by code point so a surrogate pair is never split (encodeURIComponent would throw).
    const note = Array.from(`TripSplit: ${tripName}`).slice(0, 50).join('');
    url += `&tn=${enc(note)}`;
  }
  return url;
}

/** Keep only the paid marks whose key matches a current settlement payment. */
export function pruneSettled(settled, settlements) {
  const live = new Set(settlements.map(settleKey));
  return Object.fromEntries(Object.entries(settled).filter(([k]) => live.has(k)));
}
