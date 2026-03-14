/**
 * Persist and restore FileSystemDirectoryHandles via IndexedDB.
 *
 * FileSystemDirectoryHandle is a structured-cloneable object, so it can be
 * stored directly in IndexedDB. On restore, we call requestPermission()
 * to re-verify readwrite access (Chrome grants this silently if the user
 * previously approved and the origin hasn't changed).
 *
 * Two stores:
 *   - "handles" (legacy): stores the single most-recently-opened handle
 *   - "recentProjects": stores an array of { name, handle, openedAt } entries
 */

const DB_NAME = "deckode";
const STORE_NAME = "handles";
const RECENT_STORE = "recentProjects";
const KEY = "projectDir";
const MAX_RECENT = 20;

export interface RecentProject {
  name: string;
  handle: FileSystemDirectoryHandle;
  openedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1) {
        db.createObjectStore(STORE_NAME);
      }
      if (event.oldVersion < 2) {
        db.createObjectStore(RECENT_STORE, { keyPath: "name" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Skip-restore flag (set synchronously before closeProject to win the race) ──

let _skipRestore = false;

/** Call synchronously before closeProject() so the next restoreHandle() is a no-op. */
export function skipNextRestore(): void {
  _skipRestore = true;
}

// ── Per-tab project tracking via sessionStorage ──

const SESSION_PROJECT_KEY = "deckode:tabProject";

/** Remember which project this tab has open (survives refresh, not shared across tabs). */
export function setTabProject(name: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  if (name) {
    sessionStorage.setItem(SESSION_PROJECT_KEY, name);
  } else {
    sessionStorage.removeItem(SESSION_PROJECT_KEY);
  }
}

/** Get the project name this tab had open before refresh. */
export function getTabProject(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(SESSION_PROJECT_KEY);
}

// ── Single handle (legacy, used for auto-restore on load) ──

export async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  setTabProject(handle.name);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function restoreHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (_skipRestore) {
    _skipRestore = false;
    clearHandle();
    setTabProject(null);
    return null;
  }

  // Check sessionStorage for per-tab project identity
  const tabProject = getTabProject();

  const db = await openDB();
  const handle: FileSystemDirectoryHandle | undefined = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!handle) return null;

  // If this tab had a specific project and the stored handle is for a different one, skip
  if (tabProject && handle.name !== tabProject) {
    // Try to find the correct handle from recent projects instead
    const recent = await listRecentProjects();
    const match = recent.find((r) => r.name === tabProject);
    if (match) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perm = await (match.handle as any).requestPermission({ mode: "readwrite" });
      if (perm === "granted") return match.handle;
    }
    return null;
  }

  // Re-verify permission (may prompt user or succeed silently)
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

// ── Recent projects list ──

export async function addRecentProject(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  const entry: RecentProject = {
    name: handle.name,
    handle,
    openedAt: Date.now(),
  };

  // Upsert by name (keyPath)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RECENT_STORE, "readwrite");
    tx.objectStore(RECENT_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Trim to MAX_RECENT entries (keep most recent)
  const all = await listRecentProjects();
  if (all.length > MAX_RECENT) {
    const toRemove = all.slice(MAX_RECENT);
    const db2 = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db2.transaction(RECENT_STORE, "readwrite");
      const store = tx.objectStore(RECENT_STORE);
      for (const entry of toRemove) {
        store.delete(entry.name);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export async function listRecentProjects(): Promise<RecentProject[]> {
  const db = await openDB();
  const entries: RecentProject[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(RECENT_STORE, "readonly");
    const req = tx.objectStore(RECENT_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
  // Sort by openedAt descending (most recent first)
  entries.sort((a, b) => b.openedAt - a.openedAt);
  return entries;
}

export async function removeRecentProject(name: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECENT_STORE, "readwrite");
    tx.objectStore(RECENT_STORE).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
