// Bill / receipt files are stored in IndexedDB (much larger quota than
// localStorage). Expenses only keep a `receiptId` reference.

const DB_NAME = 'tripsplit';
const STORE = 'receipts';
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    dbPromise = null; // allow retry later
    throw err;
  });
  return dbPromise;
}

async function run(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** @param {string} id @param {Blob} blob */
export const saveReceipt = (id, blob) => run('readwrite', (s) => s.put(blob, id));

/** @returns {Promise<Blob|undefined>} */
export const getReceipt = (id) => run('readonly', (s) => s.get(id));

export const deleteReceipt = (id) => run('readwrite', (s) => s.delete(id));

export const deleteReceipts = (ids) =>
  ids.length ? run('readwrite', (s) => ids.forEach((id) => s.delete(id))) : Promise.resolve();

export const listReceiptIds = () => run('readonly', (s) => s.getAllKeys());

export const clearReceipts = () => run('readwrite', (s) => s.clear());

/** Remove stored files that no expense references any more. */
export async function pruneOrphanReceipts(state) {
  const used = new Set(state.trips.flatMap((t) => t.expenses.map((e) => e.receiptId).filter(Boolean)));
  const ids = await listReceiptIds();
  await deleteReceipts(ids.filter((id) => !used.has(id)));
}
