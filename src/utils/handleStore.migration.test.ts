/**
 * Tests for the IndexedDB migration in handleStore.ts.
 *
 * migrateFromLegacy copies every record from the pre-rebrand "deckode"
 * database (three stores: handles, recentProjects, contextProjects) into
 * the new "tekkal" database and deletes the legacy DB. This runs on
 * first openDB() call and must be idempotent — subsequent calls must
 * not re-migrate or corrupt the new DB.
 *
 * Isolation strategy: each test installs a fresh FDBFactory as the
 * global indexedDB AND calls vi.resetModules() so that handleStore's
 * cached migration promise is discarded. The module is then dynamically
 * re-imported inside each test, guaranteeing one migration per test.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";

// Install a sessionStorage stub that handleStore imports at module load.
const sessionMap = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
  get length() { return sessionMap.size; },
  clear: () => sessionMap.clear(),
  getItem: (k) => (sessionMap.has(k) ? sessionMap.get(k)! : null),
  key: (i) => [...sessionMap.keys()][i] ?? null,
  removeItem: (k) => { sessionMap.delete(k); },
  setItem: (k, v) => { sessionMap.set(k, String(v)); },
};

// ── Helpers ──

function mockHandle(name: string): FileSystemDirectoryHandle {
  // Minimal structurally-typed handle for structured clone. The migration
  // path only cares about the structured-clone round trip, not the
  // FileSystemDirectoryHandle methods.
  return { name, kind: "directory" } as unknown as FileSystemDirectoryHandle;
}

function openDatabase(name: string, version: number, upgrade: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = () => upgrade(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function seedLegacyDatabase(records: {
  handles?: Array<{ key: string; value: unknown }>;
  recentProjects?: Array<{ name: string; handle: unknown; openedAt: number }>;
  contextProjects?: Array<{ name: string; handle: unknown; registeredAt: number }>;
}): Promise<void> {
  const db = await openDatabase("deckode", 3, (db) => {
    if (!db.objectStoreNames.contains("handles")) db.createObjectStore("handles");
    if (!db.objectStoreNames.contains("recentProjects")) {
      db.createObjectStore("recentProjects", { keyPath: "name" });
    }
    if (!db.objectStoreNames.contains("contextProjects")) {
      db.createObjectStore("contextProjects", { keyPath: "name" });
    }
  });

  if (records.handles) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction("handles", "readwrite");
      const store = tx.objectStore("handles");
      for (const { key, value } of records.handles!) store.put(value, key);
      tx.oncomplete = () => resolve();
    });
  }

  if (records.recentProjects) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction("recentProjects", "readwrite");
      const store = tx.objectStore("recentProjects");
      for (const rec of records.recentProjects!) store.put(rec);
      tx.oncomplete = () => resolve();
    });
  }

  if (records.contextProjects) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction("contextProjects", "readwrite");
      const store = tx.objectStore("contextProjects");
      for (const rec of records.contextProjects!) store.put(rec);
      tx.oncomplete = () => resolve();
    });
  }

  db.close();
}

// Swap in a fresh indexedDB factory per test so that databases from prior
// tests cannot leak, and reset the module cache so handleStore rebuilds
// its _migrationPromise against the new factory.
beforeEach(() => {
  sessionMap.clear();
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new FakeIDBFactory();
  vi.resetModules();
});

async function importHandleStore() {
  return await import("./handleStore");
}

// ─────────────────────────────────────────────────────────────────────
// Migration behavior
// ─────────────────────────────────────────────────────────────────────

describe("handleStore — IndexedDB migration from deckode → tekkal", () => {
  it("migrates recentProjects records from legacy DB on first openDB call", async () => {
    await seedLegacyDatabase({
      recentProjects: [
        { name: "alpha", handle: mockHandle("alpha"), openedAt: 100 },
        { name: "beta", handle: mockHandle("beta"), openedAt: 200 },
      ],
    });

    const { listRecentProjects } = await importHandleStore();
    const recents = await listRecentProjects();

    expect(recents).toHaveLength(2);
    const names = recents.map((r) => r.name).sort();
    expect(names).toEqual(["alpha", "beta"]);
  });

  it("migrates contextProjects records from legacy DB", async () => {
    await seedLegacyDatabase({
      contextProjects: [
        { name: "proj-a", handle: mockHandle("proj-a"), registeredAt: 10 },
        { name: "proj-b", handle: mockHandle("proj-b"), registeredAt: 20 },
      ],
    });

    const { listContextProjects } = await importHandleStore();
    const contexts = await listContextProjects();
    expect(contexts).toHaveLength(2);
  });

  it("migrates all three stores together when they all have data", async () => {
    await seedLegacyDatabase({
      handles: [{ key: "projectDir", value: mockHandle("current") }],
      recentProjects: [
        { name: "recent1", handle: mockHandle("recent1"), openedAt: 1 },
      ],
      contextProjects: [
        { name: "ctx1", handle: mockHandle("ctx1"), registeredAt: 1 },
      ],
    });

    const { listRecentProjects, listContextProjects } = await importHandleStore();
    const recents = await listRecentProjects();
    const contexts = await listContextProjects();

    expect(recents).toHaveLength(1);
    expect(recents[0]!.name).toBe("recent1");
    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.name).toBe("ctx1");
  });

  it("returns empty arrays when neither DB has data", async () => {
    const { listRecentProjects, listContextProjects } = await importHandleStore();
    const recents = await listRecentProjects();
    const contexts = await listContextProjects();
    expect(recents).toEqual([]);
    expect(contexts).toEqual([]);
  });

  it("is safe to call when only recentProjects has data", async () => {
    await seedLegacyDatabase({
      recentProjects: [
        { name: "only", handle: mockHandle("only"), openedAt: 1 },
      ],
    });
    const { listRecentProjects, listContextProjects } = await importHandleStore();
    const recents = await listRecentProjects();
    const contexts = await listContextProjects();
    expect(recents).toHaveLength(1);
    expect(contexts).toEqual([]);
  });

  it("is safe to call with an empty legacy DB (stores exist but no records)", async () => {
    await seedLegacyDatabase({});
    const { listRecentProjects } = await importHandleStore();
    const recents = await listRecentProjects();
    expect(recents).toEqual([]);
  });

  it("subsequent calls after migration return data consistently", async () => {
    await seedLegacyDatabase({
      recentProjects: [
        { name: "survivor", handle: mockHandle("survivor"), openedAt: 42 },
      ],
    });

    const { listRecentProjects } = await importHandleStore();
    const firstResults = await listRecentProjects();
    expect(firstResults).toHaveLength(1);

    const secondResults = await listRecentProjects();
    expect(secondResults).toHaveLength(1);
    expect(secondResults[0]!.name).toBe("survivor");
  });

  it("supports writing through addRecentProject after migration", async () => {
    await seedLegacyDatabase({
      recentProjects: [
        { name: "old", handle: mockHandle("old"), openedAt: 1 },
      ],
    });

    const { listRecentProjects, addRecentProject } = await importHandleStore();
    await listRecentProjects(); // trigger migration
    await addRecentProject(mockHandle("new-project"));

    const recents = await listRecentProjects();
    const names = recents.map((r) => r.name).sort();
    expect(names).toContain("new-project");
    expect(names).toContain("old");
  });

  it("tekkal DB with existing data skips migration entirely", async () => {
    // Pre-populate BOTH databases. Migration should detect tekkal is
    // non-empty and leave it alone — not overwrite with legacy data.
    const db = await openDatabase("tekkal", 3, (db) => {
      if (!db.objectStoreNames.contains("handles")) db.createObjectStore("handles");
      if (!db.objectStoreNames.contains("recentProjects")) {
        db.createObjectStore("recentProjects", { keyPath: "name" });
      }
      if (!db.objectStoreNames.contains("contextProjects")) {
        db.createObjectStore("contextProjects", { keyPath: "name" });
      }
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("recentProjects", "readwrite");
      tx.objectStore("recentProjects").put({
        name: "already-in-new",
        handle: mockHandle("already-in-new"),
        openedAt: 999,
      });
      tx.oncomplete = () => resolve();
    });
    db.close();

    // Legacy has different data
    await seedLegacyDatabase({
      recentProjects: [
        { name: "legacy-only", handle: mockHandle("legacy-only"), openedAt: 1 },
      ],
    });

    const { listRecentProjects } = await importHandleStore();
    const recents = await listRecentProjects();

    // Should see the pre-existing tekkal data, not the legacy data
    const names = recents.map((r) => r.name);
    expect(names).toContain("already-in-new");
    expect(names).not.toContain("legacy-only");
  });
});
