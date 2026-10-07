// localStorage persistence with defensive validation so corrupt or
// hand-edited data never crashes the app.

export const STORAGE_KEY = 'tripsplit:v1';
export const SCHEMA_VERSION = 1;

export function createInitialState() {
  return {
    version: SCHEMA_VERSION,
    settings: { currency: '₹', theme: null },
    activeTripId: null,
    trips: [],
  };
}

const isStr = (v) => typeof v === 'string';
/** Profile photos are small JPEG data URLs (~10 KB) stored inline. */
export const isPhoto = (v) => isStr(v) && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length < 300_000;
/** Payment QR images: JPEG/PNG/WebP data URLs under 900,000 chars (R12.5). */
export const isQr = (v) => isStr(v) && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length < 900_000;
/** R12.19: 3–50 chars, exactly one "@" with ≥1 char either side, no whitespace. Callers pass the trimmed value. */
export const isUpi = (v) => isStr(v) && v.length >= 3 && v.length <= 50 && !/\s/.test(v) && /^[^@]+@[^@]+$/.test(v);
/** Trim a stored UPI ID and keep it only if it passes the R12.19 rule. */
const cleanUpi = (v) => {
  const s = isStr(v) ? v.trim() : '';
  return isUpi(s) ? s : null;
};
// ── Cloud sharing info (owner + member emails) ─────────────────────────────
export const MAX_MEMBERS = 30;
export const normEmail = (e) => String(e ?? '').trim().toLowerCase();
export const isEmail = (e) => isStr(e) && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
/** Validate a trip's `cloud` block; null when absent or malformed. */
export function sanitizeCloud(c) {
  if (!c || typeof c !== 'object') return null;
  if (!isStr(c.ownerUid) || !c.ownerUid || !isEmail(normEmail(c.ownerEmail)) || !Array.isArray(c.memberEmails)) return null;
  const memberEmails = [...new Set(c.memberEmails.map(normEmail).filter(isEmail))].slice(0, MAX_MEMBERS);
  if (!memberEmails.length) return null;
  return { ownerUid: c.ownerUid, ownerEmail: normEmail(c.ownerEmail), memberEmails };
}

const isDateStr = (v) => v === '' || (isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v));

function sanitizeExpense(e, participantIds) {
  if (!e || !isStr(e.id) || !isStr(e.description)) return null;
  if (!Number.isSafeInteger(e.amount) || e.amount <= 0) return null;
  if (!participantIds.has(e.paidBy)) return null;
  if (!isStr(e.dateTime) || Number.isNaN(new Date(e.dateTime).getTime())) return null;
  if (!Array.isArray(e.participantIds)) return null;
  const ids = [...new Set(e.participantIds.filter((id) => participantIds.has(id)))];
  if (ids.length === 0) return null;

  let splitMode = e.splitMode === 'custom' ? 'custom' : 'equal';
  let customShares = null;
  if (splitMode === 'custom') {
    const src = e.customShares && typeof e.customShares === 'object' ? e.customShares : {};
    customShares = {};
    let sum = 0;
    for (const id of ids) {
      const v = src[id];
      if (!Number.isSafeInteger(v) || v < 0) return null;
      customShares[id] = v;
      sum += v;
    }
    // A custom split that doesn't add up would break the zero-sum invariant.
    if (sum !== e.amount) return null;
  }
  return {
    id: e.id,
    description: e.description,
    category: isStr(e.category) && e.category.trim() ? e.category.trim().slice(0, 30) : null,
    amount: e.amount,
    paidBy: e.paidBy,
    dateTime: e.dateTime,
    splitMode,
    participantIds: ids,
    customShares,
    receiptId: isStr(e.receiptId) && e.receiptId ? e.receiptId : null,
  };
}

function sanitizeTrip(t) {
  if (!t || !isStr(t.id) || !isStr(t.name)) return null;
  const participants = Array.isArray(t.participants)
    ? t.participants
        .filter((p) => p && isStr(p.id) && isStr(p.name))
        .map((p) => ({
          id: p.id,
          name: p.name,
          photo: isPhoto(p.photo) ? p.photo : null,
          upi: cleanUpi(p.upi),
          // A missing, non-image or oversized QR becomes null; the rest of the participant is kept.
          qr: isQr(p.qr) ? p.qr : null,
        }))
    : [];
  const pIds = new Set(participants.map((p) => p.id));
  const expenses = Array.isArray(t.expenses)
    ? t.expenses.map((e) => sanitizeExpense(e, pIds)).filter(Boolean)
    : [];
  return {
    id: t.id,
    name: t.name,
    startDate: isDateStr(t.startDate) ? t.startDate : '',
    endDate: isDateStr(t.endDate) ? t.endDate : '',
    createdAt: isStr(t.createdAt) ? t.createdAt : new Date().toISOString(),
    lastPayerId: pIds.has(t.lastPayerId) ? t.lastPayerId : null,
    participants,
    expenses,
    settled: sanitizeSettled(t.settled),
    ...(sanitizeCloud(t.cloud) ? { cloud: sanitizeCloud(t.cloud) } : {}),
  };
}

function sanitizeSettled(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (/^[^|]+\|[^|]+\|\d+$/.test(k) && isStr(v) && !Number.isNaN(Date.parse(v))) out[k] = v;
  }
  return out;
}

/** Validate an arbitrary parsed object into a well-formed state. */
export function sanitizeState(raw) {
  const base = createInitialState();
  if (!raw || typeof raw !== 'object') return base;

  const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const currency = isStr(settings.currency) && settings.currency.trim() ? settings.currency.trim().slice(0, 4) : '₹';
  const theme = settings.theme === 'dark' || settings.theme === 'light' ? settings.theme : null;

  const trips = Array.isArray(raw.trips) ? raw.trips.map(sanitizeTrip).filter(Boolean) : [];
  const activeTripId = trips.some((t) => t.id === raw.activeTripId) ? raw.activeTripId : trips[0]?.id ?? null;

  return { version: SCHEMA_VERSION, settings: { currency, theme }, activeTripId, trips };
}

/** Parse a JSON string from storage; returns a fresh state on any failure. */
export function parseState(json) {
  if (!json) return createInitialState();
  try {
    return sanitizeState(JSON.parse(json));
  } catch {
    return createInitialState();
  }
}

export function loadState(storage = globalThis.localStorage) {
  try {
    return parseState(storage?.getItem(STORAGE_KEY));
  } catch {
    // Access can throw in private mode / when storage is disabled.
    return createInitialState();
  }
}

/** @returns {boolean} whether the save succeeded */
export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('TripSplit: could not save data', err);
    return false;
  }
}
