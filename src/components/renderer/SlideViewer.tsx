import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "./SlideRenderer";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import type { SlideTransition } from "@/types/deck";

const transitionVariants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 80 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -80 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

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

  const transition: SlideTransition = slide.transition ?? { type: "fade", duration: 300 };
  const variant = transitionVariants[transition.type] ?? transitionVariants.fade;
  const duration = (transition.duration ?? 300) / 1000;

  return (
    <div ref={containerRef} className="h-full w-full flex items-center justify-center bg-zinc-950 overflow-hidden">
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={variant.initial}
            animate={variant.animate}
            exit={variant.exit}
            transition={{ duration }}
          >
            <SlideRenderer slide={slide} scale={scale} animate />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-4 right-4 text-zinc-500 text-sm font-mono">
        {currentSlideIndex + 1} / {deck.slides.length}
      </div>
    </div>
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[SlideViewer] ${message}`);
}
