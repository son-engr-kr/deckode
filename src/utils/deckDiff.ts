import type { Deck } from "@/types/deck";

export interface UndoChanges {
  slideIndex: number;
  elementIds: string[];
}

export function findUndoChanges(oldDeck: Deck | null, newDeck: Deck | null): UndoChanges {
  const noChange: UndoChanges = { slideIndex: -1, elementIds: [] };

  if (!oldDeck || !newDeck) return noChange;
  if (oldDeck === newDeck) return noChange;

  // Slide count changed — navigate to the end of the shorter deck
  if (oldDeck.slides.length !== newDeck.slides.length) {
    // If slides were removed, navigate to the position where the removal happened
    // If slides were added, navigate to the new slide
    const maxLen = Math.max(oldDeck.slides.length, newDeck.slides.length);
    for (let i = 0; i < maxLen; i++) {
      const oldStr = i < oldDeck.slides.length ? JSON.stringify(oldDeck.slides[i]) : null;
      const newStr = i < newDeck.slides.length ? JSON.stringify(newDeck.slides[i]) : null;
      if (oldStr !== newStr) {
        const targetIndex = Math.min(i, newDeck.slides.length - 1);
        return { slideIndex: targetIndex, elementIds: [] };
      }
    }
    return noChange;
  }

  // Same slide count — find first differing slide
  for (let i = 0; i < oldDeck.slides.length; i++) {
    const oldSlide = oldDeck.slides[i]!;
    const newSlide = newDeck.slides[i]!;

    if (JSON.stringify(oldSlide) === JSON.stringify(newSlide)) continue;

    // Found the changed slide — find changed element IDs
    const changedIds: string[] = [];

    const oldMap = new Map(oldSlide.elements.map((e) => [e.id, JSON.stringify(e)]));
    const newMap = new Map(newSlide.elements.map((e) => [e.id, JSON.stringify(e)]));

    // Elements that were modified (exist in both, but content differs)
    for (const [id, newStr] of newMap) {
      const oldStr = oldMap.get(id);
      if (oldStr !== undefined && oldStr !== newStr) {
        changedIds.push(id);
      }
    }

    return { slideIndex: i, elementIds: changedIds };
  }

  return noChange;
}
