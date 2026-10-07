// Pure mapping between the local trip shape and the Supabase tables.
//
//   trips                    one row per trip (metadata, participants without images, settled, members)
//   expenses                 one row per expense with trip_id FK
//   media                    one row per participant with trip_id FK (photo, qr images)
//
// Bills (receipts) stay on the device that attached them (IndexedDB) and are not uploaded.

import { sanitizeState, sanitizeCloud, normEmail, isEmail, MAX_MEMBERS } from '../storage/storage.js';

export { sanitizeCloud, normEmail, isEmail, MAX_MEMBERS };

/** JSON with sorted object keys, so equal data always gives an equal string. */
export function stableStringify(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  return `{${Object.keys(v)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
    .join(',')}}`;
}

/** Trip document body for Supabase (snake_case columns). */
export function dbTrip(trip) {
  return {
    id: trip.id,
    name: trip.name,
    start_date: trip.startDate || '',
    end_date: trip.endDate || '',
    created_at: trip.createdAt,
    last_payer_id: trip.lastPayerId ?? null,
    participants: trip.participants.map((p) => ({ id: p.id, name: p.name, upi: p.upi ?? null })),
    settled: trip.settled ?? {},
    owner_uid: trip.cloud.ownerUid,
    owner_email: trip.cloud.ownerEmail,
    member_emails: trip.cloud.memberEmails,
  };
}

/** Expense document body for Supabase. */
export function dbExpense(tripId, e) {
  return {
    id: e.id,
    trip_id: tripId,
    description: e.description,
    category: e.category ?? null,
    amount: e.amount,
    paid_by: e.paidBy,
    date_time: e.dateTime,
    split_mode: e.splitMode,
    participant_ids: e.participantIds,
    custom_shares: e.customShares ?? null,
  };
}

/** Media document body for Supabase, or null when the person has no photo and no QR. */
export function dbMedia(tripId, p) {
  if (!p.photo && !p.qr) return null;
  return { trip_id: tripId, participant_id: p.id, photo: p.photo ?? null, qr: p.qr ?? null };
}

/**
 * Rebuild a local trip from its Supabase rows. Remote data is untrusted
 * (any member can write with RLS off), so it goes through the same sanitizer as local storage.
 * @param {string} id
 * @param {object} meta     trip row
 * @param {Map<string, object>} expenses id -> expense row
 * @param {Map<string, object>} media    participantId -> media row
 * @param {object|undefined} prev        current local copy (to keep device-only receiptIds)
 */
export function joinTrip(id, meta, expenses, media, prev) {
  const cloud = sanitizeCloud({
    ownerUid: meta.owner_uid,
    ownerEmail: meta.owner_email,
    memberEmails: meta.member_emails,
  });
  if (!cloud) return null;
  const participants = (Array.isArray(meta.participants) ? meta.participants : []).map((p) => ({
    ...p,
    photo: media.get(p?.id)?.photo ?? null,
    qr: media.get(p?.id)?.qr ?? null,
  }));
  const list = [...expenses.entries()]
    .map(([eid, e]) => ({
      id: eid,
      description: e.description,
      category: e.category,
      amount: e.amount,
      paidBy: e.paid_by,
      dateTime: e.date_time,
      splitMode: e.split_mode,
      participantIds: e.participant_ids,
      customShares: e.custom_shares,
    }))
    .sort((a, b) => String(a.dateTime).localeCompare(String(b.dateTime)) || a.id.localeCompare(b.id));
  const [trip] = sanitizeState({
    trips: [
      {
        id,
        name: meta.name,
        startDate: meta.start_date,
        endDate: meta.end_date,
        createdAt: meta.created_at,
        lastPayerId: meta.last_payer_id,
        participants,
        expenses: list,
        settled: meta.settled,
      },
    ],
  }).trips;
  if (!trip) return null;
  const receipts = new Map((prev?.expenses ?? []).map((e) => [e.id, e.receiptId ?? null]));
  return {
    ...trip,
    expenses: trip.expenses.map((e) => ({ ...e, receiptId: receipts.get(e.id) ?? null })),
    cloud,
  };
}

/** Shadow keys: the last known server value of each document, as a stable string. */
export const keys = {
  trip: (tid) => `t:${tid}`,
  expense: (tid, eid) => `e:${tid}:${eid}`,
  media: (tid, pid) => `m:${tid}:${pid}`,
};

/** Every shadow entry a trip's current local state corresponds to. */
export function tripDocs(trip) {
  const docs = new Map([[keys.trip(trip.id), stableStringify(dbTrip(trip))]]);
  for (const e of trip.expenses) docs.set(keys.expense(trip.id, e.id), stableStringify(dbExpense(trip.id, e)));
  for (const p of trip.participants) {
    const m = dbMedia(trip.id, p);
    if (m) docs.set(keys.media(trip.id, p.id), stableStringify(m));
  }
  return docs;
}

/**
 * Work out the Supabase writes that bring the server in line with the local
 * trip, given the shadow (last known server state). Pure.
 * @returns {Array<{kind:'set'|'delete', path:string[], data?:object}>}
 */
export function diffTrip(trip, shadow) {
  const ops = [];
  const want = tripDocs(trip);
  const tid = trip.id;
  const metaKey = keys.trip(tid);
  if (shadow.get(metaKey) !== want.get(metaKey)) ops.push({ kind: 'set', path: ['trips', tid], data: dbTrip(trip), key: metaKey });
  for (const e of trip.expenses) {
    const k = keys.expense(tid, e.id);
    if (shadow.get(k) !== want.get(k)) ops.push({ kind: 'set', path: ['trips', tid, 'expenses', e.id], data: dbExpense(tid, e), key: k });
  }
  for (const p of trip.participants) {
    const k = keys.media(tid, p.id);
    const m = dbMedia(tid, p);
    if (m && shadow.get(k) !== want.get(k)) ops.push({ kind: 'set', path: ['trips', tid, 'media', p.id], data: m, key: k });
  }
  for (const k of shadow.keys()) {
    if (want.has(k)) continue;
    const [type, t, id] = k.split(':');
    if (t !== tid) continue;
    if (type === 'e') ops.push({ kind: 'delete', path: ['trips', tid, 'expenses', id], key: k });
    if (type === 'm') ops.push({ kind: 'delete', path: ['trips', tid, 'media', id], key: k });
  }
  return ops;
}
