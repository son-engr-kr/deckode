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

const DB_NAME = "tekkal";
const LEGACY_DB_NAME = "deckode";
const STORE_NAME = "handles";
const RECENT_STORE = "recentProjects";
const CONTEXT_PROJECTS_STORE = "contextProjects";
const KEY = "projectDir";
const MAX_RECENT = 20;

export interface RecentProject {
  name: string;
  handle: FileSystemDirectoryHandle;
  openedAt: number;
}

export interface ContextProject {
  name: string;
  handle: FileSystemDirectoryHandle;
  registeredAt: number;
}

let _migrationPromise: Promise<void> | null = null;

/**
 * One-time migration from the pre-rebrand "deckode" IndexedDB to the new
 * "tekkal" database. Runs before the first openDB() call. Copies every
 * record from each object store in the legacy DB into the new one, then
 * deletes the legacy DB. Safe to call repeatedly — after migration, the
 * legacy DB no longer exists and migrateFromLegacy becomes a no-op.
 *
 * Directory handles are stored as structured clones, which survive the
 * copy intact. User permissions persist through structured clone because
 * the origin has not changed.
 */
async function migrateFromLegacy(): Promise<void> {
  if (_migrationPromise) return _migrationPromise;
  _migrationPromise = (async () => {
    // Does a tekkal DB already exist with data? Then skip migration entirely.
    try {
      const existing = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 3);
        req.onupgradeneeded = (event) => {
          const db = req.result;
          if (event.oldVersion < 1) db.createObjectStore(STORE_NAME);
          if (event.oldVersion < 2) db.createObjectStore(RECENT_STORE, { keyPath: "name" });
          if (event.oldVersion < 3) db.createObjectStore(CONTEXT_PROJECTS_STORE, { keyPath: "name" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      // Check if any store has data
      const hasData = await new Promise<boolean>((resolve) => {
        const tx = existing.transaction([STORE_NAME, RECENT_STORE, CONTEXT_PROJECTS_STORE], "readonly");
        const h = tx.objectStore(STORE_NAME).count();
        const r = tx.objectStore(RECENT_STORE).count();
        const c = tx.objectStore(CONTEXT_PROJECTS_STORE).count();
        tx.oncomplete = () => resolve((h.result ?? 0) + (r.result ?? 0) + (c.result ?? 0) > 0);
        tx.onerror = () => resolve(false);
      });
      if (hasData) {
        existing.close();
        return;
      }
      existing.close();
    } catch {
      // New DB couldn't open — we'll fall through to migration attempt below
    }

    // Try to open the legacy DB and copy records into the new DB.
    let legacy: IDBDatabase;
    try {
      legacy = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(LEGACY_DB_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        // Don't trigger onupgradeneeded; we want the DB at whatever version it is
      });
    } catch {
      return; // No legacy DB, nothing to migrate
    }

    const storesToCopy = [STORE_NAME, RECENT_STORE, CONTEXT_PROJECTS_STORE].filter(
      (s) => legacy.objectStoreNames.contains(s),
    );
    if (storesToCopy.length === 0) {
      legacy.close();
      return;
    }

    // Read all records from legacy
    const records: Record<string, Array<{ key: IDBValidKey; value: unknown }>> = {};
    for (const storeName of storesToCopy) {
      records[storeName] = await new Promise((resolve) => {
        const tx = legacy.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.openCursor();
        const entries: Array<{ key: IDBValidKey; value: unknown }> = [];
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            entries.push({ key: cursor.primaryKey, value: cursor.value });
            cursor.continue();
          } else {
            resolve(entries);
          }
        };
        req.onerror = () => resolve(entries);
      });
    }
    legacy.close();

    // Write records into the new DB
    const target = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 3);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        if (event.oldVersion < 1) db.createObjectStore(STORE_NAME);
        if (event.oldVersion < 2) db.createObjectStore(RECENT_STORE, { keyPath: "name" });
        if (event.oldVersion < 3) db.createObjectStore(CONTEXT_PROJECTS_STORE, { keyPath: "name" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    for (const [storeName, entries] of Object.entries(records)) {
      if (entries.length === 0) continue;
      await new Promise<void>((resolve) => {
        const tx = target.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        for (const { key, value } of entries) {
          // For keyPath stores, put() ignores the key arg; for KEY stores, use it
          if (storeName === STORE_NAME) {
            store.put(value, key);
          } else {
            store.put(value);
          }
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
    target.close();

    // Delete legacy DB so we do not migrate twice
    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(LEGACY_DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    } catch {
      // Best-effort
    }
  })();
  return _migrationPromise;
}

function openDB(): Promise<IDBDatabase> {
  return migrateFromLegacy().then(() => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1) {
        db.createObjectStore(STORE_NAME);
      }
      if (event.oldVersion < 2) {
        db.createObjectStore(RECENT_STORE, { keyPath: "name" });
      }
      if (event.oldVersion < 3) {
        db.createObjectStore(CONTEXT_PROJECTS_STORE, { keyPath: "name" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

// ── Skip-restore flag (set synchronously before closeProject to win the race) ──

let _skipRestore = false;

/** Call synchronously before closeProject() so the next restoreHandle() is a no-op. */
export function skipNextRestore(): void {
  _skipRestore = true;
}

// ── Per-tab project tracking via sessionStorage ──

const SESSION_PROJECT_KEY = "tekkal:tabProject";

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

// ── Context projects (external reference folders for AI chat) ──

export async function saveContextProject(handle: FileSystemDirectoryHandle): Promise<ContextProject> {
  const db = await openDB();
  const entry: ContextProject = {
    name: handle.name,
    handle,
    registeredAt: Date.now(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CONTEXT_PROJECTS_STORE, "readwrite");
    tx.objectStore(CONTEXT_PROJECTS_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return entry;
}

export async function listContextProjects(): Promise<ContextProject[]> {
  const db = await openDB();
  const entries: ContextProject[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(CONTEXT_PROJECTS_STORE, "readonly");
    const req = tx.objectStore(CONTEXT_PROJECTS_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
  entries.sort((a, b) => b.registeredAt - a.registeredAt);
  return entries;
}

export async function removeContextProject(name: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONTEXT_PROJECTS_STORE, "readwrite");
    tx.objectStore(CONTEXT_PROJECTS_STORE).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
