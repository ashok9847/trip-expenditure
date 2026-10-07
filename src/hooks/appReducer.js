import { createId } from '../utils/id.js';
import { createInitialState, sanitizeCloud } from '../storage/storage.js';
import { stableStringify } from '../cloud/model.js';
import { pruneSettled } from '../utils/pay.js';

/** Case-insensitive check for a duplicate participant name within a trip. */
export function isDuplicateName(trip, name, exceptId = null) {
  const key = name.trim().toLocaleLowerCase();
  return trip.participants.some((p) => p.id !== exceptId && p.name.trim().toLocaleLowerCase() === key);
}

export function isParticipantUsed(trip, participantId) {
  return trip.expenses.some((e) => e.paidBy === participantId || e.participantIds.includes(participantId));
}

function updateTrip(state, tripId, fn) {
  let changed = false;
  const trips = state.trips.map((t) => {
    if (t.id !== tripId) return t;
    const next = fn(t);
    if (next !== t) changed = true;
    return next;
  });
  return changed ? { ...state, trips } : state;
}

/** Keep an expense's participantIds in the trip's participant order (stable rounding). */
function orderIds(trip, ids) {
  const set = new Set(ids);
  return trip.participants.map((p) => p.id).filter((id) => set.has(id));
}

function normalizeExpense(trip, e) {
  const participantIds = orderIds(trip, e.participantIds);
  return {
    id: e.id,
    description: e.description.trim(),
    category: typeof e.category === 'string' && e.category.trim() ? e.category.trim().slice(0, 30) : null,
    amount: e.amount,
    paidBy: e.paidBy,
    dateTime: e.dateTime,
    splitMode: e.splitMode === 'custom' ? 'custom' : 'equal',
    participantIds,
    customShares:
      e.splitMode === 'custom' ? Object.fromEntries(participantIds.map((id) => [id, e.customShares?.[id] ?? 0])) : null,
    receiptId: e.receiptId ?? null,
  };
}

export function appReducer(state, action) {
  switch (action.type) {
    case 'REPLACE_STATE':
      return action.state;

    case 'RESET':
      return { ...createInitialState(), settings: state.settings };

    case 'ADD_TRIP': {
      const trip = {
        id: action.id ?? createId(),
        name: action.name.trim(),
        startDate: action.startDate || '',
        endDate: action.endDate || '',
        createdAt: new Date().toISOString(),
        lastPayerId: null,
        participants: [],
        expenses: [],
        settled: {},
      };
      return { ...state, trips: [...state.trips, trip], activeTripId: trip.id };
    }

    // Add a fully-formed trip (the built-in demo).
    case 'IMPORT_TRIP':
      return { ...state, trips: [...state.trips, action.trip], activeTripId: action.trip.id };

    // Mark / unmark one settle-up payment as done.
    case 'TOGGLE_SETTLED':
      return updateTrip(state, action.tripId, (t) => {
        const settled = { ...(t.settled ?? {}) };
        if (settled[action.key]) delete settled[action.key];
        else settled[action.key] = new Date().toISOString();
        return { ...t, settled };
      });

    // Drop paid marks whose payment no longer exists. Same trip (and state) when nothing is removed.
    case 'PRUNE_SETTLED':
      return updateTrip(state, action.tripId, (t) => {
        const current = t.settled ?? {};
        const settled = pruneSettled(current, action.settlements);
        return Object.keys(settled).length === Object.keys(current).length ? t : { ...t, settled };
      });

    case 'UPDATE_TRIP':
      return updateTrip(state, action.id, (t) => ({
        ...t,
        name: action.name.trim(),
        startDate: action.startDate || '',
        endDate: action.endDate || '',
      }));

    case 'DELETE_TRIP': {
      const trips = state.trips.filter((t) => t.id !== action.id);
      const activeTripId = state.activeTripId === action.id ? trips[0]?.id ?? null : state.activeTripId;
      return { ...state, trips, activeTripId };
    }

    case 'SET_ACTIVE_TRIP':
      return state.trips.some((t) => t.id === action.id) ? { ...state, activeTripId: action.id } : state;

    case 'ADD_PARTICIPANT':
      return updateTrip(state, action.tripId, (t) => {
        const name = action.name.trim();
        if (!name || isDuplicateName(t, name)) return t;
        return {
          ...t,
          participants: [...t.participants, { id: action.id ?? createId(), name, photo: action.photo ?? null, upi: action.upi ?? null, qr: action.qr ?? null }],
        };
      });

    case 'RENAME_PARTICIPANT':
      return updateTrip(state, action.tripId, (t) => {
        const name = action.name.trim();
        if (!name || isDuplicateName(t, name, action.id)) return t;
        return { ...t, participants: t.participants.map((p) => (p.id === action.id ? { ...p, name } : p)) };
      });

    // Name, optional photo (data URL or null), optional UPI ID and optional QR image (data URL or null).
    case 'UPDATE_PARTICIPANT':
      return updateTrip(state, action.tripId, (t) => {
        const name = action.name.trim();
        if (!name || isDuplicateName(t, name, action.id)) return t;
        return {
          ...t,
          participants: t.participants.map((p) =>
            p.id === action.id ? { ...p, name, photo: action.photo ?? null, upi: action.upi ?? null, qr: action.qr ?? null } : p,
          ),
        };
      });

    case 'REMOVE_PARTICIPANT':
      return updateTrip(state, action.tripId, (t) => {
        // Invariant: never orphan an expense. The UI explains why removal is blocked.
        if (isParticipantUsed(t, action.id)) return t;
        return {
          ...t,
          participants: t.participants.filter((p) => p.id !== action.id),
          lastPayerId: t.lastPayerId === action.id ? null : t.lastPayerId,
        };
      });

    case 'ADD_EXPENSE':
      return updateTrip(state, action.tripId, (t) => {
        const expense = normalizeExpense(t, { ...action.expense, id: action.expense.id ?? createId() });
        return { ...t, expenses: [...t.expenses, expense], lastPayerId: expense.paidBy };
      });

    case 'UPDATE_EXPENSE':
      return updateTrip(state, action.tripId, (t) => ({
        ...t,
        expenses: t.expenses.map((e) => (e.id === action.expense.id ? normalizeExpense(t, action.expense) : e)),
      }));

    case 'DELETE_EXPENSE':
      return updateTrip(state, action.tripId, (t) => ({ ...t, expenses: t.expenses.filter((e) => e.id !== action.id) }));

    // ── Cloud sync ─────────────────────────────────────────────────────────
    // Remote trips arrive already sanitized. Unchanged trips keep their identity
    // (and the state stays the same object) so nothing re-renders or re-saves.
    case 'MERGE_CLOUD_TRIPS': {
      const removed = new Set(action.removedIds ?? []);
      const incoming = new Map(action.trips.map((t) => [t.id, t]));
      let changed = false;
      const trips = [];
      for (const t of state.trips) {
        if (removed.has(t.id)) {
          changed = true;
          continue;
        }
        const next = incoming.get(t.id);
        incoming.delete(t.id);
        if (next && stableStringify(next) !== stableStringify(t)) {
          trips.push(next);
          changed = true;
        } else trips.push(t);
      }
      for (const t of incoming.values()) {
        trips.push(t);
        changed = true;
      }
      if (!changed) return state;
      const activeTripId = trips.some((t) => t.id === state.activeTripId) ? state.activeTripId : trips[0]?.id ?? null;
      return { ...state, trips, activeTripId };
    }

    // A local trip becomes a cloud trip (uploaded after sign-in).
    case 'SET_TRIP_CLOUD':
      return updateTrip(state, action.id, (t) => ({ ...t, cloud: action.cloud }));

    // Owner edits who the trip is shared with.
    case 'SET_MEMBERS':
      return updateTrip(state, action.tripId, (t) => {
        if (!t.cloud) return t;
        const cloud = sanitizeCloud({ ...t.cloud, memberEmails: [t.cloud.ownerEmail, ...action.memberEmails] });
        return cloud ? { ...t, cloud } : t;
      });

    // Signing out removes shared trips from this device.
    case 'REMOVE_CLOUD_TRIPS': {
      const trips = state.trips.filter((t) => !t.cloud);
      if (trips.length === state.trips.length) return state;
      const activeTripId = trips.some((t) => t.id === state.activeTripId) ? state.activeTripId : trips[0]?.id ?? null;
      return { ...state, trips, activeTripId };
    }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    default:
      return state;
  }
}
