const pad = (n) => String(n).padStart(2, '0');

/** Value for an <input type="datetime-local"> in local time, e.g. "2026-09-29T20:45". */
export function toLocalInputValue(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local calendar day key "YYYY-MM-DD" for an ISO string / Date. */
export function toLocalDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a datetime-local value into an ISO string, or null if invalid. */
export function fromLocalInputValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "8:45 PM" – built manually so output is identical across browsers/ICU versions. */
export function formatTime(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "29 Sep, 8:45 PM" */
export function formatDateTime(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${formatTime(iso)}`;
}

/** "Tue, 29 Sep 2026" – used for log group headers. */
export function formatDayHeader(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format a trip's optional date range from "YYYY-MM-DD" strings. */
export function formatDateRange(start, end) {
  const fmt = (s) =>
    new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Until ${fmt(end)}`;
  return '';
}
