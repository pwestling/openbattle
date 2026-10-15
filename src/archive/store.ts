// The browser storage behind the archive: one IndexedDB database that outlives the tab.
// "games" holds what was saved for each link; "files" holds kept files by fingerprint.

const NAME = "openbattle-archive";
const VERSION = 1;

export const GAMES = "games";
export const FILES = "files";

let opening: Promise<IDBDatabase> | null = null;
let askedToPersist = false;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  if (!askedToPersist) {
    // Ask once that the browser not evict kept games under storage pressure. Best effort.
    askedToPersist = true;
    navigator.storage?.persist?.().catch(() => {});
  }
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(GAMES)) db.createObjectStore(GAMES);
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
    };
    request.onsuccess = () => {
      const db = request.result;
      // Let a newer tab upgrade the database; the next call here reopens it.
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      db.onclose = () => {
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("this browser refused storage"));
    // onblocked needs nothing: an older tab closes its connection on versionchange, and then this open succeeds.
  }).catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}

/** Runs one transaction over the named stores and resolves with work's result once it commits. */
export async function within<T>(
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await open();
  const tx = db.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("storage failed"));
    tx.onabort = () => reject(tx.error ?? new Error("storage was aborted"));
  });
  let result: T;
  try {
    result = await work(tx);
  } catch (error) {
    done.catch(() => {});
    try {
      tx.abort();
    } catch {
      // Already finished.
    }
    throw error;
  }
  await done;
  return result;
}

export function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("storage failed"));
  });
}
