import { useEffect } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { EditorLayout } from "@/components/editor/EditorLayout";
import sampleDeck from "../templates/default/deck.json";
import type { Deck } from "@/types/deck";

export function App() {
  const loadDeck = useDeckStore((s) => s.loadDeck);

  useEffect(() => {
    loadDeck(sampleDeck as Deck);
  }, [loadDeck]);

  return <EditorLayout />;
}
