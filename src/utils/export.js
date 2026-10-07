import { computeShares } from './splits.js';
import { formatMoney } from './money.js';
import { formatDateTime, formatDateRange, toLocalDateKey } from './dates.js';

const nameOf = (byId, id) => byId.get(id)?.name ?? 'Unknown';

/** Watermark added to everything the user shares or exports. */
export const WATERMARK = 'Made with TripSplit';

/** Map participants by id. */
export function indexParticipants(participants) {
  return new Map(participants.map((p) => [p.id, p]));
}

/**
 * Human-readable sentence for an expense:
 * "Ravi paid ₹500 for Noodles on 29 Sep, 8:45 PM, split among Ravi, Kiran, Anil, Sai"
 */
export function describeExpense(expense, byId, currency = '₹') {
  const payer = nameOf(byId, expense.paidBy);
  const names = expense.participantIds.map((id) => nameOf(byId, id)).join(', ');
  const custom = expense.splitMode === 'custom' ? ' (custom split)' : '';
  const cat = expense.category ? ` [${expense.category}]` : '';
  return `${payer} paid ${formatMoney(expense.amount, currency)} for ${expense.description}${cat} on ${formatDateTime(
    expense.dateTime,
  )}, split among ${names}${custom}`;
}

/**
 * Escape a CSV cell. Strings starting with = + - @ are prefixed with ' to prevent
 * formula injection when the file is opened in a spreadsheet.
 */
export function csvEscape(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (/[",\r\n]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;
  return str;
}

const toCsv = (rows) => rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
const major = (minor) => Number((minor / 100).toFixed(2));

const pad = (n) => String(n).padStart(2, '0');
const csvTime = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Expense log as CSV, oldest first (ledger order). */
export function buildLogCsv(trip) {
  const byId = indexParticipants(trip.participants);
  const rows = [['Date', 'Time', 'Description', 'Category', 'Paid by', 'Amount', 'Split mode', 'Split among', 'Shares', 'Bill attached']];
  const sorted = [...trip.expenses].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  for (const e of sorted) {
    const shares = computeShares(e);
    rows.push([
      toLocalDateKey(e.dateTime),
      csvTime(e.dateTime),
      e.description,
      e.category ?? '',
      nameOf(byId, e.paidBy),
      major(e.amount),
      e.splitMode,
      e.participantIds.map((id) => nameOf(byId, id)).join('; '),
      e.participantIds.map((id) => `${nameOf(byId, id)}: ${(shares[id] / 100).toFixed(2)}`).join('; '),
      e.receiptId ? 'Yes' : 'No',
    ]);
  }
  rows.push([], [WATERMARK]);
  return toCsv(rows);
}

/** Per-person summary + settle-up plan as CSV. */
export function buildSummaryCsv(trip, balances, settlements, total) {
  const byId = indexParticipants(trip.participants);
  const rows = [['Name', 'Total paid', 'Total share', 'Net balance']];
  for (const b of balances) rows.push([b.name, major(b.paid), major(b.share), major(b.net)]);
  rows.push([]);
  rows.push(['Total trip expenditure', major(total)]);
  rows.push([]);
  rows.push(['Settle up: from', 'To', 'Amount']);
  for (const s of settlements) rows.push([nameOf(byId, s.from), nameOf(byId, s.to), major(s.amount)]);
  rows.push([], [WATERMARK]);
  return toCsv(rows);
}

/** Plain-text summary formatted for WhatsApp (*bold* markers). */
export function buildShareText(trip, balances, settlements, total, currency = '₹', { includeLog = false } = {}) {
  const byId = indexParticipants(trip.participants);
  const lines = [`*TripSplit – ${trip.name}*`];
  const range = formatDateRange(trip.startDate, trip.endDate);
  if (range) lines.push(range);
  const count = trip.expenses.length;
  lines.push(`Total spent: ${formatMoney(total, currency)} (${count} expense${count === 1 ? '' : 's'})`);

  lines.push('', '*Balances*');
  for (const b of balances) {
    if (b.net > 0) lines.push(`${b.name} gets back ${formatMoney(b.net, currency)}`);
    else if (b.net < 0) lines.push(`${b.name} owes ${formatMoney(-b.net, currency)}`);
    else lines.push(`${b.name} is settled up`);
    lines.push(`    paid ${formatMoney(b.paid, currency)} · share ${formatMoney(b.share, currency)}`);
  }

  lines.push('', '*Settle up*');
  if (settlements.length === 0) lines.push('Everyone is settled up.');
  for (const s of settlements) {
    lines.push(`• ${nameOf(byId, s.from)} pays ${nameOf(byId, s.to)} ${formatMoney(s.amount, currency)}`);
  }

  if (includeLog && count > 0) {
    lines.push('', '*Expenses*');
    const sorted = [...trip.expenses].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    for (const e of sorted) lines.push(`• ${describeExpense(e, byId, currency)}`);
  }
  lines.push('', `_${WATERMARK}_`);
  return lines.join('\n');
}
