import { describe, it, expect } from 'vitest';
import { parseState, sanitizeState, loadState, saveState, createInitialState, STORAGE_KEY, isQr, isUpi } from '../storage/storage.js';
import { appReducer } from '../hooks/appReducer.js';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};

describe('storage', () => {
  it('returns a fresh state for missing or corrupt data', () => {
    expect(parseState(null)).toEqual(createInitialState());
    expect(parseState('{not json')).toEqual(createInitialState());
    expect(parseState('"a string"')).toEqual(createInitialState());
  });

  it('round-trips through save/load', () => {
    const storage = memoryStorage();
    let s = createInitialState();
    s = appReducer(s, { type: 'ADD_TRIP', name: 'Goa', id: 't1' });
    s = appReducer(s, { type: 'ADD_PARTICIPANT', tripId: 't1', name: 'Ravi', id: 'r' });
    s = appReducer(s, {
      type: 'ADD_EXPENSE',
      tripId: 't1',
      expense: { description: 'Tea', amount: 4000, paidBy: 'r', participantIds: ['r'], splitMode: 'equal', dateTime: new Date().toISOString() },
    });
    expect(saveState(s, storage)).toBe(true);
    // Loaded participants always carry `qr` (null when absent).
    const expected = {
      ...s,
      trips: s.trips.map((t) => ({ ...t, participants: t.participants.map((p) => ({ ...p, qr: p.qr ?? null })) })),
    };
    expect(loadState(storage)).toEqual(expected);
    expect(storage.getItem(STORAGE_KEY)).toContain('Goa');
  });

  it('drops invalid expenses and fixes a dangling active trip id', () => {
    const state = sanitizeState({
      activeTripId: 'missing',
      settings: { currency: '', theme: 'purple' },
      trips: [
        {
          id: 't',
          name: 'Trip',
          participants: [{ id: 'a', name: 'A' }],
          expenses: [
            { id: 'ok', description: 'x', amount: 100, paidBy: 'a', participantIds: ['a'], dateTime: '2026-01-01T00:00:00Z' },
            { id: 'neg', description: 'x', amount: -1, paidBy: 'a', participantIds: ['a'], dateTime: '2026-01-01T00:00:00Z' },
            { id: 'ghost', description: 'x', amount: 100, paidBy: 'zzz', participantIds: ['a'], dateTime: '2026-01-01T00:00:00Z' },
            {
              id: 'badcustom',
              description: 'x',
              amount: 100,
              paidBy: 'a',
              participantIds: ['a'],
              splitMode: 'custom',
              customShares: { a: 50 },
              dateTime: '2026-01-01T00:00:00Z',
            },
          ],
        },
      ],
    });
    expect(state.activeTripId).toBe('t');
    expect(state.settings).toEqual({ currency: '₹', theme: null });
    expect(state.trips[0].expenses.map((e) => e.id)).toEqual(['ok']);
  });

  it('isQr accepts small jpeg/png/webp data URLs and rejects others', () => {
    for (const t of ['jpeg', 'png', 'webp']) expect(isQr(`data:image/${t};base64,AAAA`)).toBe(true);
    expect(isQr('data:image/gif;base64,AAAA')).toBe(false);
    expect(isQr('data:text/plain;base64,AAAA')).toBe(false);
    expect(isQr('https://example.com/qr.png')).toBe(false);
    expect(isQr(null)).toBe(false);
    expect(isQr(42)).toBe(false);
    const prefix = 'data:image/jpeg;base64,';
    expect(isQr(prefix + 'A'.repeat(900_000 - prefix.length - 1))).toBe(true);
    expect(isQr(prefix + 'A'.repeat(900_000 - prefix.length))).toBe(false);
  });

  it('isUpi follows the R12.19 rule', () => {
    for (const ok of ['a@b', 'priya@okaxis', 'ravi.k-1@ybl', 'x'.repeat(48) + '@y']) expect(isUpi(ok)).toBe(true);
    for (const bad of ['', 'a@', '@b', 'ab', 'noatsign', 'a@b@c', 'a b@c', 'a@b\tc', 'x'.repeat(49) + '@y', null, 5]) {
      expect(isUpi(bad)).toBe(false);
    }
  });

  it('keeps the trip when a participant has a corrupt qr, and trims/validates upi', () => {
    const qr = 'data:image/png;base64,AAAA';
    const state = sanitizeState({
      trips: [
        {
          id: 't',
          name: 'Trip',
          participants: [
            { id: 'a', name: 'A', qr: 'data:image/gif;base64,AAAA', upi: '  a@okaxis ' },
            { id: 'b', name: 'B', qr, upi: 'bad upi@x' },
            { id: 'c', name: 'C', qr: 'data:image/jpeg;base64,' + 'A'.repeat(900_000) },
          ],
          expenses: [{ id: 'e', description: 'x', amount: 100, paidBy: 'a', participantIds: ['a', 'b'], dateTime: '2026-01-01T00:00:00Z' }],
          settled: { 'a|b|50': '2026-01-02T00:00:00Z' },
        },
      ],
    });
    const [trip] = state.trips;
    expect(trip.participants).toEqual([
      { id: 'a', name: 'A', photo: null, upi: 'a@okaxis', qr: null },
      { id: 'b', name: 'B', photo: null, upi: null, qr },
      { id: 'c', name: 'C', photo: null, upi: null, qr: null },
    ]);
    expect(trip.expenses.map((e) => e.id)).toEqual(['e']);
    expect(trip.settled).toEqual({ 'a|b|50': '2026-01-02T00:00:00Z' });
  });
});

describe('appReducer', () => {
  const setup = () => {
    let s = createInitialState();
    s = appReducer(s, { type: 'ADD_TRIP', name: ' Goa ', id: 't' });
    for (const [id, name] of [['a', 'Ravi'], ['b', 'Kiran'], ['c', 'Anil']]) {
      s = appReducer(s, { type: 'ADD_PARTICIPANT', tripId: 't', name, id });
    }
    return s;
  };

  it('trims names and rejects duplicates case-insensitively', () => {
    let s = setup();
    expect(s.trips[0].name).toBe('Goa');
    s = appReducer(s, { type: 'ADD_PARTICIPANT', tripId: 't', name: 'ravi ' });
    expect(s.trips[0].participants).toHaveLength(3);
  });

  it('blocks removing a participant used in an expense', () => {
    let s = setup();
    s = appReducer(s, {
      type: 'ADD_EXPENSE',
      tripId: 't',
      expense: { description: 'Cab', amount: 300, paidBy: 'a', participantIds: ['b'], splitMode: 'equal', dateTime: new Date().toISOString() },
    });
    const blocked = appReducer(s, { type: 'REMOVE_PARTICIPANT', tripId: 't', id: 'b' });
    expect(blocked).toBe(s);
    const removed = appReducer(s, { type: 'REMOVE_PARTICIPANT', tripId: 't', id: 'c' });
    expect(removed.trips[0].participants.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('stores split participants in trip order and remembers the last payer', () => {
    let s = setup();
    s = appReducer(s, {
      type: 'ADD_EXPENSE',
      tripId: 't',
      expense: { description: 'x', amount: 100, paidBy: 'b', participantIds: ['c', 'a'], splitMode: 'equal', dateTime: new Date().toISOString() },
    });
    expect(s.trips[0].expenses[0].participantIds).toEqual(['a', 'c']);
    expect(s.trips[0].lastPayerId).toBe('b');
  });

  it('switches the active trip when the active one is deleted', () => {
    let s = setup();
    s = appReducer(s, { type: 'ADD_TRIP', name: 'Manali', id: 't2' });
    expect(s.activeTripId).toBe('t2');
    s = appReducer(s, { type: 'DELETE_TRIP', id: 't2' });
    expect(s.activeTripId).toBe('t');
  });
});
