import { useState, useEffect, useCallback } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { SlideList } from "./SlideList";
import { EditorCanvas } from "./EditorCanvas";
import { PropertyPanel } from "./PropertyPanel";
import { CodePanel } from "./CodePanel";
import { ElementPalette } from "./ElementPalette";

type BottomPanel = "code" | null;

export function EditorLayout() {
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>(null);
  const [presenting, setPresenting] = useState(false);
  const isDirty = useDeckStore((s) => s.isDirty);
  const isSaving = useDeckStore((s) => s.isSaving);
  const saveToDisk = useDeckStore((s) => s.saveToDisk);

  const handleSave = useCallback(() => {
    saveToDisk();
  }, [saveToDisk]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        setPresenting(true);
        return;
      }

      // Skip remaining shortcuts if typing in an input
      if (isInput) return;

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        useDeckStore.temporal.getState().undo();
        return;
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === "Z" || e.key === "y")) {
        e.preventDefault();
        useDeckStore.temporal.getState().redo();
        return;
      }
      // Duplicate element: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        const { deck, currentSlideIndex, selectedElementId, duplicateElement } = useDeckStore.getState();
        if (deck && selectedElementId) {
          const slide = deck.slides[currentSlideIndex];
          if (slide) duplicateElement(slide.id, selectedElementId);
        }
        return;
      }
      // Delete selected element
      if (e.key === "Delete" || e.key === "Backspace") {
        const { deck, currentSlideIndex, selectedElementId, deleteElement } = useDeckStore.getState();
        if (deck && selectedElementId) {
          const slide = deck.slides[currentSlideIndex];
          if (slide) deleteElement(slide.id, selectedElementId);
        }
        return;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleSave]);

  if (presenting) {
    return <PresentationMode onExit={() => setPresenting(false)} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white">
      {/* Toolbar */}
      <div className="h-10 border-b border-zinc-800 flex items-center px-4 gap-4 shrink-0">
        <span className="text-sm font-semibold text-zinc-300">Deckode</span>

        {/* Save status */}
        <span className="text-xs text-zinc-500">
          {isSaving ? "Saving..." : isDirty ? "Unsaved" : "Saved"}
        </span>

        <div className="flex-1" />

        <button
          onClick={() => useDeckStore.temporal.getState().undo()}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={() => useDeckStore.temporal.getState().redo()}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>

        <div className="w-px h-5 bg-zinc-700" />

        <ElementPalette />

        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => setPresenting(true)}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Present (F5)
        </button>
        <button
          onClick={() => setBottomPanel(bottomPanel === "code" ? null : "code")}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            bottomPanel === "code"
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          JSON
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slide list sidebar */}
        <div className="w-[170px] border-r border-zinc-800 overflow-y-auto shrink-0">
          <SlideList />
        </div>

        {/* Center: canvas + optional bottom panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <EditorCanvas />

          {bottomPanel === "code" && (
            <div className="h-[280px] border-t border-zinc-800 shrink-0">
              <CodePanel />
            </div>
          )}
        </div>

        {/* Right: property panel */}
        <div className="w-[240px] border-l border-zinc-800 overflow-y-auto shrink-0">
          <PropertyPanel />
        </div>
      </div>
    </div>
  );
}

// Inline presentation mode component
function PresentationMode({ onExit }: { onExit: () => void }) {
  const deck = useDeckStore((s) => s.deck);
  const nextSlide = useDeckStore((s) => s.nextSlide);
  const prevSlide = useDeckStore((s) => s.prevSlide);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevSlide();
      }
    };
    window.addEventListener("keydown", handleKey);

    // Enter fullscreen
    document.documentElement.requestFullscreen?.();

    return () => {
      window.removeEventListener("keydown", handleKey);
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    };
  }, [onExit, nextSlide, prevSlide]);

  if (!deck) return null;

  // Import SlideViewer lazily to avoid circular issues
  // Just render inline for simplicity
  return (
    <div className="h-screen w-screen bg-black">
      <SlideViewerPresentation />
    </div>
  );
}

// Simplified SlideViewer for presentation mode (no editor chrome)
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import { AnimatePresence, motion } from "framer-motion";
import type { SlideTransition } from "@/types/deck";

const transitionVariants = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  slide: { initial: { opacity: 0, x: 80 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -80 } },
  none: { initial: {}, animate: {}, exit: {} },
};

function SlideViewerPresentation() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const scaleX = window.innerWidth / CANVAS_WIDTH;
      const scaleY = window.innerHeight / CANVAS_HEIGHT;
      setScale(Math.min(scaleX, scaleY));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!deck) return null;
  const slide = deck.slides[currentSlideIndex]!;
  const transition: SlideTransition = slide.transition ?? { type: "fade", duration: 300 };
  const variant = transitionVariants[transition.type] ?? transitionVariants.fade;

  return (
    <div className="h-full w-full flex items-center justify-center bg-black cursor-default">
      <div>
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={variant.initial}
            animate={variant.animate}
            exit={variant.exit}
            transition={{ duration: (transition.duration ?? 300) / 1000 }}
          >
            <SlideRenderer slide={slide} scale={scale} animate />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
