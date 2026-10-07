import { describe, it, expect } from 'vitest';
import { csvEscape, buildLogCsv, buildSummaryCsv, buildShareText, describeExpense, indexParticipants } from '../utils/export.js';
import { computeBalances, totalExpenditure } from '../utils/balances.js';
import { settleUp } from '../utils/settlement.js';

const trip = {
  id: 't',
  name: 'Goa',
  startDate: '2026-09-28',
  endDate: '2026-10-02',
  participants: [
    { id: 'r', name: 'Ravi' },
    { id: 'k', name: 'Kiran' },
  ],
  expenses: [
    {
      id: 'e1',
      description: 'Noodles, "spicy"',
      amount: 50000,
      paidBy: 'r',
      participantIds: ['r', 'k'],
      splitMode: 'equal',
      customShares: null,
      dateTime: new Date(2026, 8, 29, 20, 45).toISOString(),
    },
  ],
};

describe('csvEscape', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"');
    expect(csvEscape(12.5)).toBe('12.5');
    expect(csvEscape(null)).toBe('');
  });

  it('neutralises spreadsheet formula injection', () => {
    expect(csvEscape('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvEscape('@cmd')).toBe("'@cmd");
  });
});

describe('builders', () => {
  const balances = computeBalances(trip.participants, trip.expenses);
  const settlements = settleUp(balances);
  const total = totalExpenditure(trip.expenses);

  it('describes an expense in one sentence', () => {
    expect(describeExpense(trip.expenses[0], indexParticipants(trip.participants), '₹')).toBe(
      'Ravi paid ₹500 for Noodles, "spicy" on 29 Sep, 8:45 PM, split among Ravi, Kiran',
    );
  });

  it('builds the log CSV', () => {
    const lines = buildLogCsv(trip).split('\r\n');
    expect(lines[0]).toBe('Date,Time,Description,Category,Paid by,Amount,Split mode,Split among,Shares,Bill attached');
    expect(lines[1]).toBe('2026-09-29,20:45,"Noodles, ""spicy""",,Ravi,500,equal,Ravi; Kiran,Ravi: 250.00; Kiran: 250.00,No');
    expect(lines[lines.length - 1]).toBe('Made with TripSplit');
    const withCat = { ...trip, expenses: [{ ...trip.expenses[0], category: 'Food' }] };
    expect(buildLogCsv(withCat).split('\r\n')[1]).toContain('"Noodles, ""spicy""",Food,Ravi');
    const withBill = { ...trip, expenses: [{ ...trip.expenses[0], receiptId: 'r1' }] };
    expect(buildLogCsv(withBill).split('\r\n')[1].endsWith(',Yes')).toBe(true);
  });

  it('builds the summary CSV', () => {
    const csv = buildSummaryCsv(trip, balances, settlements, total);
    expect(csv).toContain('Ravi,500,250,250');
    expect(csv).toContain('Kiran,0,250,-250');
    expect(csv).toContain('Kiran,Ravi,250');
  });

  it('builds WhatsApp text', () => {
    const text = buildShareText(trip, balances, settlements, total, '₹', { includeLog: true });
    expect(text).toContain('*TripSplit – Goa*');
    expect(text).toContain('Total spent: ₹500 (1 expense)');
    expect(text).toContain('Ravi gets back ₹250');
    expect(text).toContain('Kiran owes ₹250');
    expect(text).toContain('• Kiran pays Ravi ₹250');
    expect(text).toContain('*Expenses*');
    expect(text.trim().endsWith('_Made with TripSplit_')).toBe(true);
    expect(buildSummaryCsv(trip, balances, settlements, total).endsWith('Made with TripSplit')).toBe(true);
  });
});
