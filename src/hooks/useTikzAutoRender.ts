import { useEffect, useRef } from "react";
import { useAdapter } from "@/contexts/AdapterContext";
import { useDeckStore } from "@/stores/deckStore";
import type { Deck, TikZElement } from "@/types/deck";

function needsRender(el: TikZElement): boolean {
  if (!el.svgUrl) return true;
  if (el.content !== el.renderedContent) return true;
  if ((el.preamble ?? "") !== (el.renderedPreamble ?? "")) return true;
  return false;
}

function collectStale(deck: Deck): { slideId: string; element: TikZElement }[] {
  const result: { slideId: string; element: TikZElement }[] = [];
  for (const slide of deck.slides) {
    for (const el of slide.elements) {
      if (el.type === "tikz" && needsRender(el as TikZElement)) {
        result.push({ slideId: slide.id, element: el as TikZElement });
      }
    }
  }
  return result;
}

/**
 * Subscribes to deck changes and sequentially renders any TikZ elements
 * whose content/preamble don't match their last rendered source.
 */
export function useTikzAutoRender() {
  const adapter = useAdapter();
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  useEffect(() => {
    const rendering = new Set<string>();
    let active = false;
    let disposed = false;

    async function renderStale() {
      if (active || disposed) return;
      const deck = useDeckStore.getState().deck;
      if (!deck) return;

      const stale = collectStale(deck).filter(
        (item) => !rendering.has(item.element.id),
      );
      if (stale.length === 0) return;

      active = true;
      try {
        for (const { slideId, element } of stale) {
          if (disposed) break;
          rendering.add(element.id);
          const result = await adapterRef.current.renderTikz(
            element.id,
            element.content,
            element.preamble,
          );
          rendering.delete(element.id);
          if (disposed) break;
          if (result.ok) {
            useDeckStore.getState().updateElement(slideId, element.id, {
              svgUrl: result.svgUrl,
              renderedContent: element.content,
              renderedPreamble: element.preamble ?? "",
            });
          }
        }
      } finally {
        active = false;
      }
      if (!disposed) renderStale();
    }

    renderStale();

    const unsub = useDeckStore.subscribe(
      (state) => state.deck,
      () => renderStale(),
    );

    return () => {
      disposed = true;
      unsub();
    };
  }, []);
}
