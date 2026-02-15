import type { Deck } from "@/types/deck";

export async function loadDeckFromDisk(): Promise<Deck | null> {
  const res = await fetch("/api/load-deck");
  if (!res.ok) return null;
  return res.json() as Promise<Deck>;
}

export async function saveDeckToDisk(deck: Deck): Promise<void> {
  const res = await fetch("/api/save-deck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(deck, null, 2),
  });
  assert(res.ok, `Failed to save deck: ${res.status}`);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[API] ${message}`);
}
