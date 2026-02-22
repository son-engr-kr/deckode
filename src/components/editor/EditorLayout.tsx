import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { findUndoChanges } from "@/utils/deckDiff";
import { SlideList } from "./SlideList";
import { EditorCanvas } from "./EditorCanvas";
import { PropertyPanel } from "./PropertyPanel";
import { CodePanel } from "./CodePanel";
import { ElementPalette } from "./ElementPalette";
import { SlideAnimationList } from "./SlideAnimationList";
import { ThemePanel } from "./ThemePanel";

function performUndoRedo(direction: "undo" | "redo") {
  const temporal = useDeckStore.temporal.getState();
  const pastLen = temporal.pastStates.length;
  const futureLen = temporal.futureStates.length;
  if (direction === "undo" && pastLen === 0) return;
  if (direction === "redo" && futureLen === 0) return;

  const oldDeck = useDeckStore.getState().deck;
  temporal[direction]();
  const newDeck = useDeckStore.getState().deck;

  const changes = findUndoChanges(oldDeck, newDeck);
  if (changes.slideIndex !== -1) {
    useDeckStore.getState().setCurrentSlide(changes.slideIndex);
  }
  if (changes.elementIds.length > 0) {
    useDeckStore.getState().highlightElements(changes.elementIds);
  }
}

type BottomPanel = "code" | null;
type RightPanel = "properties" | "theme";

export function EditorLayout() {
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("properties");
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
        document.documentElement.requestFullscreen?.();
        setPresenting(true);
        return;
      }

      // Skip remaining shortcuts if typing in an input
      if (isInput) return;

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        performUndoRedo("undo");
        return;
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === "Z" || e.key === "y")) {
        e.preventDefault();
        performUndoRedo("redo");
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
        <button
          onClick={() => useDeckStore.getState().closeProject()}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Back to projects"
        >
          Projects
        </button>
        <span className="text-sm font-semibold text-zinc-300">
          {useDeckStore.getState().currentProject}
        </span>

        {/* Save status */}
        <span className="text-xs text-zinc-500">
          {isSaving ? "Saving..." : isDirty ? "Unsaved" : "Saved"}
        </span>

        <div className="flex-1" />

        <button
          onClick={() => performUndoRedo("undo")}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={() => performUndoRedo("redo")}
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
          onClick={() => {
            document.documentElement.requestFullscreen?.();
            setPresenting(true);
          }}
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Present (F5)
        </button>
        <button
          onClick={() => setRightPanel(rightPanel === "theme" ? "properties" : "theme")}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            rightPanel === "theme"
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Theme
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

        {/* Right sidebar */}
        <div className="w-[240px] border-l border-zinc-800 flex flex-col shrink-0">
          {rightPanel === "theme" ? (
            <div className="flex-1 overflow-y-auto">
              <ThemePanel />
            </div>
          ) : (
            <>
              {/* Properties — top half */}
              <div className="flex-1 overflow-y-auto border-b border-zinc-800">
                <PropertyPanel />
              </div>
              {/* Animations — bottom half */}
              <div className="flex-1 overflow-y-auto">
                <SlideAnimationList
                  onSelectElement={(elementId) => {
                    useDeckStore.getState().selectElement(elementId);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline presentation mode component
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import { AnimatePresence, motion } from "framer-motion";
import type { SlideTransition } from "@/types/deck";
import { computeSteps } from "@/utils/animationSteps";
import type { AnimationStep } from "@/utils/animationSteps";
import { usePresentationChannel } from "@/hooks/usePresentationChannel";

const transitionVariants = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  slide: { initial: { opacity: 0, x: 80 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -80 } },
  none: { initial: {}, animate: {}, exit: {} },
};

function PresentationMode({ onExit }: { onExit: () => void }) {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const setCurrentSlide = useDeckStore((s) => s.setCurrentSlide);
  const nextSlide = useDeckStore((s) => s.nextSlide);
  const prevSlide = useDeckStore((s) => s.prevSlide);
  const [activeStep, setActiveStep] = useState(0);
  const [pointer, setPointer] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });

  const slide = deck?.slides[currentSlideIndex];
  const steps = useMemo(
    () => computeSteps(slide?.animations ?? []),
    [slide?.animations],
  );

  // Reset activeStep when slide changes
  useEffect(() => {
    setActiveStep(0);
  }, [currentSlideIndex]);

  const advance = useCallback(() => {
    if (activeStep < steps.length) {
      setActiveStep((prev) => prev + 1);
    } else {
      nextSlide();
    }
  }, [activeStep, steps.length, nextSlide]);

  // Use refs so the keydown handler always reads the latest values without re-registering
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const activeStepRef = useRef(activeStep);
  activeStepRef.current = activeStep;

  // --- Presenter window ---
  const presenterWindowRef = useRef<Window | null>(null);

  // Skip broadcasting when the navigation change came from the channel
  const skipNextBroadcast = useRef(false);

  const { postNavigate, postExit } = usePresentationChannel({
    onNavigate: (slideIndex, step) => {
      skipNextBroadcast.current = true;
      setCurrentSlide(slideIndex);
      setActiveStep(step);
    },
    onExit: () => {
      presenterWindowRef.current = null;
      onExit();
    },
    onSyncRequest: () => {
      postNavigate(
        useDeckStore.getState().currentSlideIndex,
        activeStepRef.current,
      );
    },
    onPointer: (x, y, visible) => {
      setPointer({ x, y, visible });
    },
  });

  // Broadcast navigation changes to presenter (skip if the change came from channel)
  const prevSlideIndex = useRef(currentSlideIndex);
  const prevActiveStep = useRef(activeStep);
  useEffect(() => {
    if (
      prevSlideIndex.current === currentSlideIndex &&
      prevActiveStep.current === activeStep
    ) {
      return;
    }
    prevSlideIndex.current = currentSlideIndex;
    prevActiveStep.current = activeStep;

    if (skipNextBroadcast.current) {
      skipNextBroadcast.current = false;
      return;
    }
    postNavigate(currentSlideIndex, activeStep);
  }, [currentSlideIndex, activeStep, postNavigate]);

  // Open presenter window on mount, close on unmount
  useEffect(() => {
    const project = useDeckStore.getState().currentProject;
    const url = `?project=${encodeURIComponent(project!)}&mode=presenter`;
    presenterWindowRef.current = window.open(
      url,
      "deckode-presenter",
      "width=960,height=600",
    );
    return () => {
      presenterWindowRef.current?.close();
      presenterWindowRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExit = useCallback(() => {
    postExit();
    presenterWindowRef.current?.close();
    presenterWindowRef.current = null;
    onExit();
  }, [postExit, onExit]);

  // Exit fullscreen on unmount (entry is handled by the user-gesture handler — F5 key / button click)
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    };
  }, []);

  // Keyboard handler: stable deps via ref
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleExit();
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        advanceRef.current();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevSlide();
      } else {
        // Check if current step is an onKey step matching this key
        const currentStep = stepsRef.current[activeStepRef.current];
        if (currentStep?.trigger === "onKey" && currentStep.key === e.key) {
          e.preventDefault();
          advanceRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleExit, prevSlide]);

  if (!deck) return null;

  return (
    <div className="h-screen w-screen bg-black">
      <SlideViewerPresentation activeStep={activeStep} steps={steps} onAdvance={advance} pointer={pointer} />
    </div>
  );
}

// Simplified SlideViewer for presentation mode (no editor chrome)
function SlideViewerPresentation({
  activeStep,
  steps,
  onAdvance,
  pointer,
}: {
  activeStep: number;
  steps: AnimationStep[];
  onAdvance: () => void;
  pointer: { x: number; y: number; visible: boolean };
}) {
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
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={variant.initial}
            animate={variant.animate}
            exit={variant.exit}
            transition={{ duration: (transition.duration ?? 300) / 1000 }}
          >
            <SlideRenderer
              slide={slide}
              scale={scale}
              animate
              activeStep={activeStep}
              steps={steps}
              onAdvance={onAdvance}
              theme={deck?.theme}
            />
          </motion.div>
        </AnimatePresence>
        {/* Laser pointer dot */}
        {pointer.visible && (
          <div
            className="absolute w-3 h-3 rounded-full bg-red-500 pointer-events-none"
            style={{
              left: `${pointer.x * 100}%`,
              top: `${pointer.y * 100}%`,
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 12px 4px rgba(239, 68, 68, 0.6)",
            }}
          />
        )}
      </div>
    </div>
  );
}
