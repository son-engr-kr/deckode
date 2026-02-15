import { useEffect, useRef, useState, useCallback } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "./SlideRenderer";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";

export function SlideViewer() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const nextSlide = useDeckStore((s) => s.nextSlide);
  const prevSlide = useDeckStore((s) => s.prevSlide);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { clientWidth, clientHeight } = container;
    const scaleX = clientWidth / CANVAS_WIDTH;
    const scaleY = clientHeight / CANVAS_HEIGHT;
    setScale(Math.min(scaleX, scaleY));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevSlide();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextSlide, prevSlide]);

  if (!deck) {
    return (
      <div className="h-full w-full flex items-center justify-center text-zinc-500">
        No deck loaded
      </div>
    );
  }

  const slide = deck.slides[currentSlideIndex];
  assert(slide !== undefined, `Slide at index ${currentSlideIndex} not found`);

  const scaledWidth = CANVAS_WIDTH * scale;
  const scaledHeight = CANVAS_HEIGHT * scale;

  return (
    <div ref={containerRef} className="h-full w-full flex items-center justify-center bg-zinc-950">
      <div style={{ width: scaledWidth, height: scaledHeight }}>
        <SlideRenderer slide={slide} scale={scale} />
      </div>

      {/* Slide counter */}
      <div className="absolute bottom-4 right-4 text-zinc-500 text-sm font-mono">
        {currentSlideIndex + 1} / {deck.slides.length}
      </div>
    </div>
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[SlideViewer] ${message}`);
}
