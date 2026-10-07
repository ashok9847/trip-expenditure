import { describe, it, expect } from 'vitest';
import { diffTrip, joinTrip, keys, stableStringify, tripDocs, sanitizeCloud, normEmail, isEmail, dbExpense, dbTrip } from '../cloud/model.js';
import { makeDemoTrip } from '../utils/demoTrip.js';
import { appReducer } from '../hooks/appReducer.js';

let n = 0;
const cloud = { ownerUid: 'u1', ownerEmail: 'owner@gmail.com', memberEmails: ['owner@gmail.com', 'friend@gmail.com'] };
const trip = { ...makeDemoTrip(() => `id${n++}`), cloud };
trip.participants[0] = { ...trip.participants[0], photo: 'data:image/jpeg;base64,AAAA' };
trip.expenses[0] = { ...trip.expenses[0], receiptId: 'bill-1' };

describe('cloud model', () => {
  it('normalises and validates emails and member lists', () => {
    expect(normEmail('  A@Gmail.COM ')).toBe('a@gmail.com');
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('nope')).toBe(false);
    expect(sanitizeCloud({ ownerUid: 'u', ownerEmail: 'O@x.com', memberEmails: ['O@x.com', 'o@x.com', 'bad', 'b@y.io'] })).toEqual({
      ownerUid: 'u',
      ownerEmail: 'o@x.com',
      memberEmails: ['o@x.com', 'b@y.io'],
    });
    expect(sanitizeCloud({ ownerUid: 'u', ownerEmail: 'o@x.com', memberEmails: [] })).toBeNull();
  });

  it('stableStringify ignores key order', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [1, { z: 1, y: 2 }] } })).toBe(stableStringify({ a: { c: [1, { y: 2, z: 1 }], d: 2 }, b: 1 }));
  });

  it('never sends device-only receipts or undefined values', () => {
    const d = dbExpense(trip.id, trip.expenses[0]);
    expect('receiptId' in d).toBe(false);
    expect(Object.values(d).includes(undefined)).toBe(false);
    expect(dbTrip(trip).participants[0]).toEqual({ id: trip.participants[0].id, name: 'ashok', upi: null });
  });

  it('round-trips a trip through the server unchanged', () => {
    const shadow = tripDocs(trip);
    const meta = dbTrip(trip);
    const expenses = new Map(trip.expenses.map((e) => [e.id, dbExpense(trip.id, e)]));
    const media = new Map(trip.participants.filter((p) => p.photo || p.qr).map((p) => [p.id, { trip_id: trip.id, participant_id: p.id, photo: p.photo, qr: p.qr }]));
    const back = joinTrip(trip.id, meta, expenses, media, trip);
    expect(back).toEqual({ ...trip, expenses: [...trip.expenses].sort((a, b) => a.dateTime.localeCompare(b.dateTime) || a.id.localeCompare(b.id)) });
    // Once the shadow matches, nothing more needs writing.
    expect(diffTrip(back, tripDocs(back))).toEqual([]);
  });

  it('writes only what changed and deletes removed docs', () => {
    const shadow = tripDocs(trip);
    let next = { ...trip, expenses: trip.expenses.slice(1) };
    next = { ...next, participants: next.participants.map((p, i) => (i === 0 ? { ...p, photo: null } : p)) };
    next = { ...next, expenses: next.expenses.map((e, i) => (i === 0 ? { ...e, description: 'Cab home' } : e)) };
    const ops = diffTrip(next, shadow);
    expect(ops.map((o) => `${o.kind} ${o.path.slice(1).join('/')}`).sort()).toEqual(
      [`delete ${trip.id}/expenses/${trip.expenses[0].id}`, `delete ${trip.id}/media/${trip.participants[0].id}`, `set ${trip.id}/expenses/${trip.expenses[1].id}`].sort(),
    );
  });

  it('rejects junk from a malicious member', () => {
    const badRow = {
      owner_uid: 'u',
      owner_email: 'o@x.com',
      member_emails: ['o@x.com'],
      participants: [{ id: 'x', name: 'X' }],
      name: 'Trip',
      start_date: '',
      end_date: '',
      created_at: '',
      last_payer_id: null,
      settled: {},
    };
    const bad = joinTrip('t', badRow, new Map([['e', { amount: -5, paid_by: 'x', description: 'x', date_time: '', split_mode: 'equal', participant_ids: ['x'] }]]), new Map(), null);
    expect(bad?.expenses ?? []).toEqual([]);
    expect(joinTrip('t', { name: 'x' }, new Map(), new Map(), null)).toBeNull();
  });

  it('shadow keys are scoped per trip', () => {
    const other = new Map([[keys.expense('other', 'e1'), '{}']]);
    expect(diffTrip(trip, other).some((o) => o.kind === 'delete')).toBe(false);
  });
});

describe('cloud reducer actions', () => {
  const base = { version: 1, settings: { currency: '₹', theme: null }, activeTripId: null, trips: [] };

  it('merges remote trips without churn and removes gone ones', () => {
    let s = appReducer(base, { type: 'MERGE_CLOUD_TRIPS', trips: [trip], removedIds: [] });
    expect(s.activeTripId).toBe(trip.id);
    const same = appReducer(s, { type: 'MERGE_CLOUD_TRIPS', trips: [structuredClone(trip)], removedIds: [] });
    expect(same).toBe(s);
    s = appReducer(s, { type: 'MERGE_CLOUD_TRIPS', trips: [], removedIds: [trip.id] });
    expect(s.trips).toEqual([]);
    expect(s.activeTripId).toBeNull();
  });

  it('marks a trip as cloud and drops cloud trips on sign-out', () => {
    let s = appReducer(base, { type: 'IMPORT_TRIP', trip: { ...trip, cloud: undefined } });
    s = appReducer(s, { type: 'SET_TRIP_CLOUD', id: trip.id, cloud });
    expect(s.trips[0].cloud).toEqual(cloud);
    s = appReducer(s, { type: 'REMOVE_CLOUD_TRIPS' });
    expect(s.trips).toEqual([]);
  });

  it('lets the owner edit members', () => {
    let s = appReducer(base, { type: 'IMPORT_TRIP', trip });
    s = appReducer(s, { type: 'SET_MEMBERS', tripId: trip.id, memberEmails: ['owner@gmail.com', 'New@Gmail.com'] });
    expect(s.trips[0].cloud.memberEmails).toEqual(['owner@gmail.com', 'new@gmail.com']);
  });
});
