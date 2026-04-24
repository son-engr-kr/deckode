import { useEffect, useRef, useState } from "react";
import type { Deck, Slide, DeckTheme } from "@/types/deck";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import { SlideRenderer } from "./renderer/SlideRenderer";
import { DEMO_CATALOG, type DemoEntry } from "@/demos/catalog";

/**
 * Responsive scaled-down render of a slide's first page. Fills its
 * container's width, holds a 16:9 aspect ratio, and computes a
 * transform scale from the measured width so the inner 960×540 canvas
 * shrinks exactly to fit — no letterboxing, no side whitespace.
 */
interface SlidePreviewProps {
  slide: Slide;
  theme?: DeckTheme;
}

export function SlidePreview({ slide, theme }: SlidePreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / CANVAS_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="w-full bg-white overflow-hidden"
      style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
    >
      {scale > 0 && <SlideRenderer slide={slide} scale={scale} theme={theme} thumbnail />}
    </div>
  );
}

/**
 * Loads the first slide from a demo entry so we can render a live
 * preview tile. Lazy import → state so the landing page stays snappy
 * even with five decks to fetch.
 */
export function useFirstSlide(entry: DemoEntry): { slide: Slide | null; theme: DeckTheme | undefined } {
  const [deck, setDeck] = useState<Deck | null>(null);
  useEffect(() => {
    let cancelled = false;
    entry.loadDeck().then((d) => {
      if (!cancelled) setDeck(d);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);
  const slide = deck?.slides[0] ?? null;
  return { slide, theme: deck?.theme };
}

function DemoCard({ entry }: { entry: DemoEntry }) {
  const { slide, theme } = useFirstSlide(entry);
  const handleOpen = () => {
    window.location.search = `?demo=${encodeURIComponent(entry.id)}`;
  };
  return (
    <button
      onClick={handleOpen}
      className="group flex flex-col gap-2 text-left rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-zinc-600 hover:bg-zinc-800/80"
    >
      <div className="relative overflow-hidden rounded border border-zinc-800 bg-white">
        {slide ? (
          <SlidePreview slide={slide} theme={theme} />
        ) : (
          <div
            className="flex w-full items-center justify-center text-[10px] text-zinc-400"
            style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
          >
            Loading preview…
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/0 opacity-0 transition-opacity group-hover:bg-zinc-950/60 group-hover:opacity-100">
          <span className="text-xs font-medium text-white">Open demo →</span>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-zinc-100">{entry.title}</span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{entry.category}</span>
      </div>
      <p className="line-clamp-2 text-[11px] text-zinc-400">{entry.subtitle}</p>
    </button>
  );
}

/**
 * Landing-page gallery of bundled demo decks. Replaces the single
 * "Try Demo" button with a grid of live first-slide previews, one per
 * topic in `DEMO_CATALOG`.
 */
export function DemoGallery() {
  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">Demo Gallery</h2>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          {DEMO_CATALOG.length} decks
        </span>
      </div>
      <p className="mb-4 text-[11px] text-zinc-500">
        Click any deck to open it read-only. All examples share a common editorial style — navy &amp; gold on white, Inter, grid-aligned.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_CATALOG.map((entry) => (
          <DemoCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
