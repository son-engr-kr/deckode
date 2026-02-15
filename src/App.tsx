import { useEffect } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { loadDeckFromDisk } from "@/utils/api";
import sampleDeck from "../templates/default/deck.json";
import type { Deck } from "@/types/deck";

export function App() {
  // Load deck on startup
  useEffect(() => {
    loadDeckFromDisk().then((deck) => {
      useDeckStore.getState().loadDeck(deck ?? (sampleDeck as Deck));
    });
  }, []);

  // Reload deck when AI modifies it via API
  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = () => {
      loadDeckFromDisk().then((deck) => {
        if (deck) useDeckStore.getState().replaceDeck(deck);
      });
    };
    import.meta.hot.on("deckode:deck-changed", handler);
    return () => {
      import.meta.hot!.off("deckode:deck-changed", handler);
    };
  }, []);

  return <EditorLayout />;
}
