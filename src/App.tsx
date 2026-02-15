import { useEffect } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { loadDeckFromDisk } from "@/utils/api";
import sampleDeck from "../templates/default/deck.json";
import type { Deck } from "@/types/deck";

export function App() {
  const loadDeck = useDeckStore((s) => s.loadDeck);

  useEffect(() => {
    loadDeckFromDisk().then((deck) => {
      // Use disk deck if available, otherwise fall back to sample
      loadDeck(deck ?? (sampleDeck as Deck));
    });
  }, [loadDeck]);

  return <EditorLayout />;
}
