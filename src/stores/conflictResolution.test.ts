// @ts-nocheck — test file accesses .content on SlideElement union type
/**
 * Integration tests for editor-vs-external-JSON conflict resolution.
 *
 * These tests simulate real race conditions by using a mock adapter with
 * controllable async save behavior (delays, 409 conflicts).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useDeckStore, setStoreAdapter, getLastSavedDeck, setLastSavedDeck, selectIsDirty } from "./deckStore";
import { mergeDeck } from "@/utils/deckDiff";
import type { Deck, Slide } from "@/types/deck";
import type { FileSystemAdapter } from "@/adapters/types";

// -- Fixtures --

function el(id: string, content = `Element ${id}`): SlideElement {
  return { id, type: "text", content, position: { x: 0, y: 0 }, size: { w: 200, h: 50 } };
}

function slide(id: string, elements: SlideElement[] = [el(`${id}-e0`)]): Slide {
  return { id, elements };
}

function deck(slides: Slide[] = [slide("s0"), slide("s1")]): Deck {
  return { deckode: "0.1.0", meta: { title: "Test", aspectRatio: "16:9" }, slides };
}

// -- Mock adapter --

type SaveBehavior =
  | { type: "success" }
  | { type: "conflict"; diskDeck: Deck }
  | { type: "delay"; ms: number; then: SaveBehavior };

function createMockAdapter(initialDeck: Deck): {
  adapter: FileSystemAdapter;
  setSaveBehavior: (b: SaveBehavior) => void;
  saveCallCount: () => number;
  lastSavedDeck: () => Deck | null;
} {
  let saveBehavior: SaveBehavior = { type: "success" };
  let _saveCount = 0;
  let _lastSaved: Deck | null = null;
  let _currentDeck = structuredClone(initialDeck);

  const adapter: FileSystemAdapter = {
    mode: "vite" as const,
    projectName: "test-project",
    lastSaveHash: null,

    async loadDeck() {
      return structuredClone(_currentDeck);
    },

    async saveDeck(deckToSave: Deck): Promise<Deck | null> {
      _saveCount++;
      const behavior = saveBehavior;

      const resolve = async (b: SaveBehavior): Promise<Deck | null> => {
        if (b.type === "delay") {
          await new Promise((r) => setTimeout(r, b.ms));
          return resolve(b.then);
        }
        if (b.type === "conflict") {
          _currentDeck = structuredClone(b.diskDeck);
          return structuredClone(b.diskDeck);
        }
        // success
        _lastSaved = structuredClone(deckToSave);
        _currentDeck = structuredClone(deckToSave);
        return null;
      };

      return resolve(behavior);
    },

    // Stubs for unused interface methods
    async listProjects() { return []; },
    async createProject() {},
    async deleteProject() {},
    async uploadAsset() { return ""; },
    resolveAssetUrl() { return undefined; },
    async renderTikz() { return { ok: false as const, error: "stub" }; },
    async listComponents() { return []; },
    async listLayouts() { return []; },
    async loadLayout() { return slide("layout"); },
  };

  return {
    adapter,
    setSaveBehavior: (b: SaveBehavior) => { saveBehavior = b; },
    saveCallCount: () => _saveCount,
    lastSavedDeck: () => _lastSaved,
  };
}

// -- Setup --

let mock: ReturnType<typeof createMockAdapter>;

beforeEach(() => {
  const d = deck();
  mock = createMockAdapter(d);
  setStoreAdapter(mock.adapter);

  // openProject initializes the store properly
  useDeckStore.getState().openProject("test-project", structuredClone(d));
});

// -- Helper --

function isDirty(): boolean {
  return selectIsDirty(useDeckStore.getState());
}

// ============================================================
// P3: Version counter tracks mutations during in-flight save
// ============================================================

describe("version counter — mutations during save", () => {
  it("mutation during save triggers re-save and persists all changes", async () => {
    // Start with a clean state
    expect(isDirty()).toBe(false);
    const { versionId: v0 } = useDeckStore.getState();

    // Track save calls
    let saveCount = 0;
    const origSave = mock.adapter.saveDeck.bind(mock.adapter);
    mock.adapter.saveDeck = async (d: Deck) => {
      saveCount++;
      // First save: 50ms delay. Second save: instant.
      if (saveCount === 1) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return origSave(d);
    };

    // Trigger a mutation → dirty
    useDeckStore.getState().updateElement("s0", "s0-e0", { content: "Edit 1" });
    expect(isDirty()).toBe(true);
    const { versionId: v1 } = useDeckStore.getState();
    expect(v1).toBe(v0 + 1);

    // Start save (don't await yet)
    const savePromise = useDeckStore.getState().saveToDisk();

    // Mutate DURING the save
    useDeckStore.getState().updateElement("s1", "s1-e0", { content: "Edit 2 (during save)" });
    const { versionId: v2 } = useDeckStore.getState();
    expect(v2).toBe(v1 + 1);

    // Wait for save chain to complete
    await savePromise;

    // Key assertions:
    // 1. Two saves happened (first save + automatic re-save for remaining mutation)
    expect(saveCount).toBe(2);
    // 2. After re-save completes, state is clean (all mutations persisted)
    expect(isDirty()).toBe(false);
    expect(useDeckStore.getState().savedVersionId).toBe(v2);
    // 3. Both edits are in the final saved deck
    const saved = mock.lastSavedDeck()!;
    expect(saved.slides[0]!.elements[0]!.content).toBe("Edit 1");
    expect(saved.slides[1]!.elements[0]!.content).toBe("Edit 2 (during save)");
  });

  it("no mutation during save → state is clean after save", async () => {
    mock.setSaveBehavior({ type: "success" });

    useDeckStore.getState().updateElement("s0", "s0-e0", { content: "Edit" });
    expect(isDirty()).toBe(true);

    await useDeckStore.getState().saveToDisk();
    expect(isDirty()).toBe(false);
  });
});

// ============================================================
// P2: Save + external change race condition
// ============================================================

describe("save + external change race", () => {
  it("409 conflict triggers merge and re-save", async () => {
    // External change: slide s1 was modified on disk
    const diskDeck = deck();
    diskDeck.slides[1]!.elements[0]!.content = "External edit on s1";

    mock.setSaveBehavior({ type: "conflict", diskDeck });

    // Local edit on s0 (different slide)
    useDeckStore.getState().updateElement("s0", "s0-e0", { content: "Local edit on s0" });

    // After first save attempt returns 409, saveToDisk should auto-merge and retry
    // Switch to success for the retry
    let callCount = 0;
    const origSave = mock.adapter.saveDeck.bind(mock.adapter);
    mock.adapter.saveDeck = async (d: Deck) => {
      callCount++;
      if (callCount === 1) {
        // First call: simulate 409
        return structuredClone(diskDeck);
      }
      // Subsequent calls: success
      mock.setSaveBehavior({ type: "success" });
      return origSave(d);
    };

    await useDeckStore.getState().saveToDisk();

    // Verify: merged deck should have both changes
    const state = useDeckStore.getState();
    const s0Content = state.deck!.slides[0]!.elements[0]!.content;
    const s1Content = state.deck!.slides[1]!.elements[0]!.content;
    expect(s0Content).toBe("Local edit on s0");
    expect(s1Content).toBe("External edit on s1");
  });
});

// ============================================================
// P1: Base snapshot fix — consecutive external changes
// ============================================================

describe("base snapshot — consecutive external merges", () => {
  it("tryMerge updates base so second external change merges correctly", () => {
    // Simulate what App.tsx tryMerge does

    // First external change: s0 modified externally
    const remote1 = deck();
    remote1.slides[0]!.elements[0]!.content = "External v1";

    const base1 = getLastSavedDeck()!;
    const local1 = useDeckStore.getState().deck!;
    const result1 = mergeDeck(base1, local1, remote1);
    expect(result1.merged).not.toBeNull();

    // Apply merge result like App.tsx does
    setLastSavedDeck(remote1); // <-- the fix: base = disk state
    useDeckStore.getState().replaceDeck(result1.merged!);

    // Second external change: s1 modified externally
    const remote2 = structuredClone(remote1); // builds on remote1
    remote2.slides[1]!.elements[0]!.content = "External v2";

    const base2 = getLastSavedDeck()!;
    const local2 = useDeckStore.getState().deck!;
    const result2 = mergeDeck(base2, local2, remote2);

    // Without the fix (base still = original), this would produce wrong results
    expect(result2.merged).not.toBeNull();
    expect(result2.merged!.slides[0]!.elements[0]!.content).toBe("External v1");
    expect(result2.merged!.slides[1]!.elements[0]!.content).toBe("External v2");
  });

  it("setLastSavedDeck is called even when merged === local (early return)", () => {
    // External change that produces a merge identical to local
    // (e.g., external set same value that local already has)
    const remote = deck(); // same as local — merge result === local
    const baseBefore = getLastSavedDeck()!;

    // Simulate tryMerge logic (with the fix: setLastSavedDeck before early return check)
    const result = mergeDeck(baseBefore, useDeckStore.getState().deck!, remote);
    expect(result.merged).not.toBeNull();

    // The fix: always update base even if merged === local
    setLastSavedDeck(remote);

    // Verify merged === local (would have triggered early return in App.tsx)
    expect(JSON.stringify(result.merged)).toBe(JSON.stringify(useDeckStore.getState().deck));

    // Key: base should be updated to remote, not still the old base
    const baseAfter = getLastSavedDeck()!;
    expect(baseAfter).not.toBe(baseBefore);
  });

  it("without setLastSavedDeck, second merge uses stale base", () => {
    // Demonstrate the old bug: if we DON'T call setLastSavedDeck,
    // the second merge still works here because both changes are non-conflicting,
    // but the base is wrong (it's the original deck, not remote1).
    const originalBase = structuredClone(getLastSavedDeck()!);

    // First external change
    const remote1 = deck();
    remote1.slides[0]!.elements[0]!.content = "External v1";
    const result1 = mergeDeck(originalBase, useDeckStore.getState().deck!, remote1);
    expect(result1.merged).not.toBeNull();

    // Apply WITHOUT updating base (old behavior)
    useDeckStore.getState().replaceDeck(result1.merged!);

    // Local edit on s0
    useDeckStore.getState().updateElement("s0", "s0-e0", { content: "Local override" });

    // Second external change on s0 (different from remote1)
    const remote2 = structuredClone(remote1);
    remote2.slides[0]!.elements[0]!.content = "External v2";

    // Using stale base (originalBase, where s0 was "Element s0-e0")
    const staleBase = originalBase;
    const local2 = useDeckStore.getState().deck!;

    // Both local and remote changed s0 relative to stale base → both sides differ
    // With correct base (remote1), only remote changed → remote wins
    // With stale base, local also appears changed → local wins (incorrect merge priority)
    const result2 = mergeDeck(staleBase, local2, remote2);
    // This demonstrates the problem: local override is kept instead of external v2
    if (result2.merged) {
      expect(result2.merged.slides[0]!.elements[0]!.content).toBe("Local override");
      // ^ With stale base: local wins. With correct base: we'd properly detect
      //   that both changed and keep local (which is actually correct here,
      //   but the REASON is wrong — it thinks base→local changed when really
      //   the change came from merge, not user edit).
    }
  });

  it("with setLastSavedDeck, user edit + external change correctly identified", () => {
    // First external change
    const remote1 = deck();
    remote1.slides[0]!.elements[0]!.content = "External v1";
    const result1 = mergeDeck(getLastSavedDeck()!, useDeckStore.getState().deck!, remote1);
    setLastSavedDeck(remote1); // correct base update
    useDeckStore.getState().replaceDeck(result1.merged!);

    // Now user edits s1 (NOT s0)
    useDeckStore.getState().updateElement("s1", "s1-e0", { content: "User edit" });

    // Second external change on s0
    const remote2 = structuredClone(remote1);
    remote2.slides[0]!.elements[0]!.content = "External v2";

    const base = getLastSavedDeck()!; // = remote1
    const local = useDeckStore.getState().deck!;
    const result2 = mergeDeck(base, local, remote2);

    expect(result2.merged).not.toBeNull();
    // s0: base="External v1", local="External v1" (unchanged), remote="External v2"
    //   → only remote changed → accept remote ✓
    expect(result2.merged!.slides[0]!.elements[0]!.content).toBe("External v2");
    // s1: base="Element s1-e0", local="User edit", remote="Element s1-e0"
    //   → only local changed → keep local ✓
    expect(result2.merged!.slides[1]!.elements[0]!.content).toBe("User edit");
  });
});

// ============================================================
// _lastSavedDeck overwrite race
// ============================================================

describe("base snapshot — save vs tryMerge race", () => {
  it("concurrent save success does not overwrite base set by tryMerge", async () => {
    // Simulate: save in flight, tryMerge fires and updates base, save completes

    // Slow save: 50ms delay
    let saveCount = 0;
    const origSave = mock.adapter.saveDeck.bind(mock.adapter);
    mock.adapter.saveDeck = async (d: Deck) => {
      saveCount++;
      if (saveCount === 1) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return origSave(d);
    };

    // User edits s0
    useDeckStore.getState().updateElement("s0", "s0-e0", { content: "User edit" });

    // Start save (captures baseBeforeSave = original deck)
    const savePromise = useDeckStore.getState().saveToDisk();

    // While save is in flight, simulate what tryMerge does:
    // external change arrived, merge succeeded, base updated
    const remoteDeck = deck();
    remoteDeck.slides[1]!.elements[0]!.content = "External change on s1";
    setLastSavedDeck(remoteDeck);

    // Save completes
    await savePromise;

    // Key assertion: _lastSavedDeck should still be remoteDeck, NOT the stale deckToSave
    const base = getLastSavedDeck()!;
    expect(base.slides[1]!.elements[0]!.content).toBe("External change on s1");
  });

  it("save success updates base when no concurrent tryMerge", async () => {
    mock.setSaveBehavior({ type: "success" });

    useDeckStore.getState().updateElement("s0", "s0-e0", { content: "Edit" });
    await useDeckStore.getState().saveToDisk();

    // Base should be updated to what was saved
    const base = getLastSavedDeck()!;
    expect(base.slides[0]!.elements[0]!.content).toBe("Edit");
  });
});

// ============================================================
// Version counter edge cases
// ============================================================

describe("version counter edge cases", () => {
  it("loadDeck resets both counters to 0", () => {
    useDeckStore.getState().updateElement("s0", "s0-e0", { content: "dirty" });
    expect(isDirty()).toBe(true);

    useDeckStore.getState().loadDeck(deck());
    const { versionId, savedVersionId } = useDeckStore.getState();
    expect(versionId).toBe(0);
    expect(savedVersionId).toBe(0);
    expect(isDirty()).toBe(false);
  });

  it("multiple mutations increment versionId correctly", () => {
    const { versionId: v0 } = useDeckStore.getState();
    useDeckStore.getState().updateElement("s0", "s0-e0", { content: "a" });
    useDeckStore.getState().updateElement("s0", "s0-e0", { content: "b" });
    useDeckStore.getState().updateElement("s0", "s0-e0", { content: "c" });
    expect(useDeckStore.getState().versionId).toBe(v0 + 3);
  });

  it("replaceDeck increments versionId (merge result needs saving)", () => {
    const { versionId: v0 } = useDeckStore.getState();
    useDeckStore.getState().replaceDeck(deck());
    expect(useDeckStore.getState().versionId).toBe(v0 + 1);
    expect(isDirty()).toBe(true);
  });

  it("save completes with exact snapshotVersionId", async () => {
    mock.setSaveBehavior({ type: "success" });

    useDeckStore.getState().updateElement("s0", "s0-e0", { content: "edit" });
    const { versionId } = useDeckStore.getState();

    await useDeckStore.getState().saveToDisk();

    expect(useDeckStore.getState().savedVersionId).toBe(versionId);
    expect(isDirty()).toBe(false);
  });
});
