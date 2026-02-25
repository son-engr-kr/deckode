import { useEffect, useRef } from "react";
import { useAdapter } from "@/contexts/AdapterContext";
import { useDeckStore } from "@/stores/deckStore";
import type { Deck, TikZElement } from "@/types/deck";

function needsRender(el: TikZElement): boolean {
  if (!el.svgUrl) {
    // Already failed with the same content — don't retry until user edits
    if (
      el.renderError &&
      el.content === el.renderedContent &&
      (el.preamble ?? "") === (el.renderedPreamble ?? "")
    )
      return false;
    return true;
  }
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
 *
 * Handles both:
 * - Initial load: renders any stale TikZ when the deck first becomes available
 * - Live edits: re-renders when TikZ content changes while editing
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
          try {
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
                renderError: undefined,
              });
            } else {
              console.warn(`[TikzAutoRender] Failed to render ${element.id}:`, result.error);
              useDeckStore.getState().updateElement(slideId, element.id, {
                renderedContent: element.content,
                renderedPreamble: element.preamble ?? "",
                renderError: result.error,
              });
            }
          } catch (err) {
            rendering.delete(element.id);
            console.warn(`[TikzAutoRender] Error rendering ${element.id}:`, err);
            useDeckStore.getState().updateElement(slideId, element.id, {
              renderedContent: element.content,
              renderedPreamble: element.preamble ?? "",
              renderError: String(err),
            });
          }
        }
      } finally {
        active = false;
      }
      if (!disposed) renderStale();
    }

    // Initial render: the deck may already be loaded when the effect fires
    // (e.g. navigating to a project via URL). Use a microtask to ensure
    // React has finished committing the store update.
    queueMicrotask(() => {
      if (!disposed) renderStale();
    });

    // Also schedule a delayed check in case the initial call ran before
    // the deck was ready (race with async project loading).
    const initialTimer = setTimeout(() => {
      if (!disposed) renderStale();
    }, 500);

    const unsub = useDeckStore.subscribe(
      (state) => state.deck,
      () => {
        if (!disposed) renderStale();
      },
    );

    return () => {
      disposed = true;
      clearTimeout(initialTimer);
      unsub();
    };
  }, []);
}
