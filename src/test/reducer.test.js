import { describe, it, expect } from 'vitest';
import { appReducer } from '../hooks/appReducer.js';
import { computeBalances } from '../utils/balances.js';
import { settleUp } from '../utils/settlement.js';
import { settleKey } from '../utils/copy.js';
import { makeDemoTrip } from '../utils/demoTrip.js';

const QR = 'data:image/jpeg;base64,AAAA';

function baseState() {
  const trip = {
    id: 't1',
    name: 'Goa',
    startDate: '',
    endDate: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastPayerId: null,
    participants: [
      { id: 'a', name: 'Asha', photo: null, upi: null, qr: null },
      { id: 'b', name: 'Bala', photo: null, upi: null, qr: null },
    ],
    expenses: [
      {
        id: 'e1',
        description: 'Dinner',
        amount: 1000,
        paidBy: 'a',
        dateTime: '2026-01-01T20:00:00.000Z',
        splitMode: 'equal',
        participantIds: ['a', 'b'],
        customShares: null,
        receiptId: null,
      },
    ],
    settled: {},
  };
  return { trips: [trip], activeTripId: 't1', settings: {} };
}

const tripOf = (s) => s.trips[0];

describe('appReducer: participant qr', () => {
  it('ADD_PARTICIPANT stores qr, defaulting to null', () => {
    let s = appReducer(baseState(), { type: 'ADD_PARTICIPANT', tripId: 't1', id: 'c', name: 'Chitra', qr: QR });
    s = appReducer(s, { type: 'ADD_PARTICIPANT', tripId: 't1', id: 'd', name: 'Dev' });
    const [, , c, d] = tripOf(s).participants;
    expect(c.qr).toBe(QR);
    expect(d.qr).toBeNull();
  });

  it('UPDATE_PARTICIPANT sets and clears qr', () => {
    let s = appReducer(baseState(), { type: 'UPDATE_PARTICIPANT', tripId: 't1', id: 'b', name: 'Bala', qr: QR });
    expect(tripOf(s).participants[1].qr).toBe(QR);
    s = appReducer(s, { type: 'UPDATE_PARTICIPANT', tripId: 't1', id: 'b', name: 'Bala' });
    expect(tripOf(s).participants[1].qr).toBeNull();
  });

  it('REMOVE_PARTICIPANT drops the participant together with its inline qr', () => {
    let s = appReducer(baseState(), { type: 'ADD_PARTICIPANT', tripId: 't1', id: 'c', name: 'Chitra', qr: QR });
    s = appReducer(s, { type: 'REMOVE_PARTICIPANT', tripId: 't1', id: 'c' });
    expect(JSON.stringify(s)).not.toContain(QR);
  });

  it('DELETE_TRIP and RESET drop inline qr', () => {
    const s = appReducer(baseState(), { type: 'UPDATE_PARTICIPANT', tripId: 't1', id: 'a', name: 'Asha', qr: QR });
    expect(JSON.stringify(appReducer(s, { type: 'DELETE_TRIP', id: 't1' }))).not.toContain(QR);
    expect(JSON.stringify(appReducer(s, { type: 'RESET' }))).not.toContain(QR);
  });

  it('demo participants have qr: null', () => {
    let n = 0;
    const demo = makeDemoTrip(() => `id${n++}`);
    expect(demo.participants.every((p) => p.qr === null)).toBe(true);
  });
});

describe('appReducer: paid marks', () => {
  const settlementsOf = (t) => settleUp(computeBalances(t.participants, t.expenses));

  it('PRUNE_SETTLED removes stale keys and keeps live ones', () => {
    const start = baseState();
    const settlements = settlementsOf(tripOf(start));
    const live = settleKey(settlements[0]);
    start.trips[0].settled = { [live]: '2026-01-02T00:00:00.000Z', 'b|a|999': '2026-01-02T00:00:00.000Z' };
    const s = appReducer(start, { type: 'PRUNE_SETTLED', tripId: 't1', settlements });
    expect(tripOf(s).settled).toEqual({ [live]: '2026-01-02T00:00:00.000Z' });
  });

  it('PRUNE_SETTLED returns the identical state when nothing is stale', () => {
    const start = baseState();
    const settlements = settlementsOf(tripOf(start));
    start.trips[0].settled = { [settleKey(settlements[0])]: '2026-01-02T00:00:00.000Z' };
    expect(appReducer(start, { type: 'PRUNE_SETTLED', tripId: 't1', settlements })).toBe(start);

    const noMarks = baseState();
    expect(appReducer(noMarks, { type: 'PRUNE_SETTLED', tripId: 't1', settlements })).toBe(noMarks);
  });

  it('TOGGLE_SETTLED only touches settled; expenses, balances and settlements are unchanged', () => {
    const start = baseState();
    const before = tripOf(start);
    const key = settleKey(settlementsOf(before)[0]);
    const s = appReducer(start, { type: 'TOGGLE_SETTLED', tripId: 't1', key });
    const after = tripOf(s);
    expect(after.settled[key]).toBeTruthy();
    expect(after.expenses).toBe(before.expenses);
    expect(after.participants).toBe(before.participants);
    expect(computeBalances(after.participants, after.expenses)).toEqual(computeBalances(before.participants, before.expenses));
    expect(settlementsOf(after)).toEqual(settlementsOf(before));

    const back = tripOf(appReducer(s, { type: 'TOGGLE_SETTLED', tripId: 't1', key }));
    expect(back.settled[key]).toBeUndefined();
  });
});
