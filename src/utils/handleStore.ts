/**
 * Persist and restore a FileSystemDirectoryHandle via IndexedDB.
 *
 * FileSystemDirectoryHandle is a structured-cloneable object, so it can be
 * stored directly in IndexedDB. On restore, we call requestPermission()
 * to re-verify readwrite access (Chrome grants this silently if the user
 * previously approved and the origin hasn't changed).
 */

const DB_NAME = "deckode";
const STORE_NAME = "handles";
const KEY = "projectDir";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function restoreHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  const handle: FileSystemDirectoryHandle | undefined = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!handle) return null;

  // Re-verify permission (may prompt user or succeed silently)
  // requestPermission is not in the default TS lib types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perm = await (handle as any).requestPermission({ mode: "readwrite" });
  if (perm !== "granted") return null;

  return handle;
}

export async function clearHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
