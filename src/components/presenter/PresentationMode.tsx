import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { usePresentationChannel } from "@/hooks/usePresentationChannel";
import { computeSteps } from "@/utils/animationSteps";
import type { AnimationStep } from "@/utils/animationSteps";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import type { Deck, Slide, SlideTransition } from "@/types/deck";
import { AnimatePresence, motion } from "framer-motion";

// ── Notes parsing ─────────────────────────────────────────────────

interface NoteSegment {
  text: string;
  step: number | null; // null = always visible, number = highlighted at that step
}

function parseNotes(notes: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  const regex = /\[step:(\d+)\]([\s\S]*?)\[\/step\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(notes)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: notes.slice(lastIndex, match.index), step: null });
    }
    segments.push({ text: match[2]!, step: parseInt(match[1]!, 10) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < notes.length) {
    segments.push({ text: notes.slice(lastIndex), step: null });
  }
  return segments;
}

// ── Transition variants ───────────────────────────────────────────

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
  none: { initial: {}, animate: {}, exit: {} },
};

// ── Main PresentationMode ─────────────────────────────────────────

type ViewMode = "presenter" | "audience";

interface PresentationModeProps {
  onExit: () => void;
}

export function PresentationMode({ onExit }: PresentationModeProps) {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const setCurrentSlide = useDeckStore((s) => s.setCurrentSlide);
  const nextSlideFn = useDeckStore((s) => s.nextSlide);
  const prevSlideFn = useDeckStore((s) => s.prevSlide);

  const [viewMode, setViewMode] = useState<ViewMode>("presenter");
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [pointerActive, setPointerActive] = useState(false);
  const [localPointer, setLocalPointer] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });
  const audienceWindowRef = useRef<Window | null>(null);

  const slide = deck?.slides[currentSlideIndex];
  const nextSlideData = deck?.slides[currentSlideIndex + 1] ?? null;
  const totalSlides = deck?.slides.length ?? 0;

  const steps = useMemo(
    () => computeSteps(slide?.animations ?? []),
    [slide?.animations],
  );

  const noteSegments = useMemo(
    () => parseNotes(slide?.notes ?? ""),
    [slide?.notes],
  );

  // Reset activeStep on slide change
  useEffect(() => {
    setActiveStep(0);
  }, [currentSlideIndex]);

  // Timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Stable refs for keyboard handler
  const activeStepRef = useRef(activeStep);
  activeStepRef.current = activeStep;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // ── Navigation ──

  const advance = useCallback(() => {
    if (activeStepRef.current < stepsRef.current.length) {
      setActiveStep((prev) => prev + 1);
    } else {
      nextSlideFn();
    }
  }, [nextSlideFn]);

  const goBack = useCallback(() => {
    if (activeStepRef.current > 0) {
      setActiveStep((prev) => prev - 1);
    } else {
      prevSlideFn();
    }
  }, [prevSlideFn]);

  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // ── BroadcastChannel ──

  const skipNextBroadcast = useRef(false);

  const { postNavigate, postExit, postPointer } = usePresentationChannel({
    onNavigate: (slideIndex, step) => {
      skipNextBroadcast.current = true;
      setCurrentSlide(slideIndex);
      setActiveStep(step);
    },
    onExit: () => {
      audienceWindowRef.current = null;
      onExit();
    },
    onSyncRequest: () => {
      postNavigate(
        useDeckStore.getState().currentSlideIndex,
        activeStepRef.current,
      );
    },
  });

  // Broadcast navigation changes
  const prevSlideIndex = useRef(currentSlideIndex);
  const prevActiveStep = useRef(activeStep);
  useEffect(() => {
    if (
      prevSlideIndex.current === currentSlideIndex &&
      prevActiveStep.current === activeStep
    )
      return;
    prevSlideIndex.current = currentSlideIndex;
    prevActiveStep.current = activeStep;
    if (skipNextBroadcast.current) {
      skipNextBroadcast.current = false;
      return;
    }
    postNavigate(currentSlideIndex, activeStep);
  }, [currentSlideIndex, activeStep, postNavigate]);

  // ── Audience popup ──

  const openAudienceWindow = useCallback(() => {
    if (audienceWindowRef.current && !audienceWindowRef.current.closed) {
      audienceWindowRef.current.focus();
      return;
    }
    const project = useDeckStore.getState().currentProject;
    const url = `?project=${encodeURIComponent(project!)}&mode=audience`;
    audienceWindowRef.current = window.open(
      url,
      "deckode-audience",
      "width=960,height=540",
    );
  }, []);

  // Cleanup audience window
  useEffect(() => {
    return () => {
      audienceWindowRef.current?.close();
      audienceWindowRef.current = null;
    };
  }, []);

  // Exit fullscreen on unmount
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    };
  }, []);

  const handleExit = useCallback(() => {
    postExit();
    audienceWindowRef.current?.close();
    audienceWindowRef.current = null;
    onExit();
  }, [postExit, onExit]);

  // ── Laser pointer ──

  const handlePointerMove = useCallback(
    (x: number, y: number) => {
      if (!pointerActive) return;
      setLocalPointer({ x, y, visible: true });
      postPointer(x, y, true);
    },
    [pointerActive, postPointer],
  );

  const handlePointerLeave = useCallback(() => {
    if (pointerActive) {
      setLocalPointer({ x: 0, y: 0, visible: false });
      postPointer(0, 0, false);
    }
  }, [pointerActive, postPointer]);

  // ── Keyboard ──

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleExit();
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        advanceRef.current();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (e.key === "p" || e.key === "P") {
        setViewMode((m) => (m === "presenter" ? "audience" : "presenter"));
      } else if (e.key === "w" || e.key === "W") {
        openAudienceWindow();
      } else if (e.key === "l" || e.key === "L") {
        setPointerActive((p) => !p);
      } else {
        const currentStep = stepsRef.current[activeStepRef.current];
        if (currentStep?.trigger === "onKey" && currentStep.key === e.key) {
          e.preventDefault();
          advanceRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleExit, goBack, openAudienceWindow]);

  if (!deck || !slide) return null;

  if (viewMode === "audience") {
    return (
      <div className="h-screen w-screen bg-black">
        <AudienceSlideViewer
          activeStep={activeStep}
          steps={steps}
          onAdvance={advance}
          pointer={localPointer}
        />
      </div>
    );
  }

  return (
    <PresenterConsole
      slide={slide}
      nextSlide={nextSlideData}
      deck={deck}
      activeStep={activeStep}
      steps={steps}
      noteSegments={noteSegments}
      currentSlideIndex={currentSlideIndex}
      totalSlides={totalSlides}
      elapsed={elapsed}
      pointerActive={pointerActive}
      localPointer={localPointer}
      onPointerToggle={() => setPointerActive((p) => !p)}
      onAdvance={advance}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onOpenAudienceWindow={openAudienceWindow}
      onToggleViewMode={() =>
        setViewMode((m) => (m === "presenter" ? "audience" : "presenter"))
      }
    />
  );
}

// ── Presenter Console ─────────────────────────────────────────────

function PresenterConsole({
  slide,
  nextSlide,
  deck,
  activeStep,
  steps,
  noteSegments,
  currentSlideIndex,
  totalSlides,
  elapsed,
  pointerActive,
  localPointer,
  onPointerToggle,
  onAdvance,
  onPointerMove,
  onPointerLeave,
  onOpenAudienceWindow,
  onToggleViewMode,
}: {
  slide: Slide;
  nextSlide: Slide | null;
  deck: Deck;
  activeStep: number;
  steps: AnimationStep[];
  noteSegments: NoteSegment[];
  currentSlideIndex: number;
  totalSlides: number;
  elapsed: number;
  pointerActive: boolean;
  localPointer: { x: number; y: number; visible: boolean };
  onPointerToggle: () => void;
  onAdvance: () => void;
  onPointerMove: (x: number, y: number) => void;
  onPointerLeave: () => void;
  onOpenAudienceWindow: () => void;
  onToggleViewMode: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const [currentScale, setCurrentScale] = useState(0.5);
  const [nextScale, setNextScale] = useState(0.2);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Current slide: left ~65% width, full height minus bottom bar (44px)
      const mainW = rect.width * 0.62;
      const mainH = rect.height - 44 - 32; // 44px bar + padding
      setCurrentScale(Math.min(mainW / CANVAS_WIDTH, mainH / CANVAS_HEIGHT));
      // Next slide: right ~35% width, top ~35% height
      const sideW = rect.width * 0.32;
      const sideH = (rect.height - 44) * 0.32;
      setNextScale(Math.min(sideW / CANVAS_WIDTH, sideH / CANVAS_HEIGHT));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleSlideMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!slideAreaRef.current) return;
      const rect = slideAreaRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      onPointerMove(x, y);
    },
    [onPointerMove],
  );

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen bg-zinc-950 text-white flex flex-col select-none"
    >
      {/* Main area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Current slide (left ~65%) */}
        <div className="flex-[2] flex items-center justify-center p-4">
          <div
            ref={slideAreaRef}
            className={`relative ${pointerActive ? "cursor-crosshair" : ""}`}
            onMouseMove={handleSlideMouseMove}
            onMouseLeave={onPointerLeave}
          >
            <SlideRenderer
              slide={slide}
              scale={currentScale}
              animate
              activeStep={activeStep}
              steps={steps}
              onAdvance={onAdvance}
              theme={deck.theme}
            />
            {/* Local laser pointer dot */}
            {pointerActive && localPointer.visible && (
              <div
                className="absolute w-3 h-3 rounded-full bg-red-500 pointer-events-none"
                style={{
                  left: `${localPointer.x * 100}%`,
                  top: `${localPointer.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  boxShadow: "0 0 12px 4px rgba(239, 68, 68, 0.6)",
                }}
              />
            )}
          </div>
        </div>

        {/* Right sidebar (~35%): next slide + notes */}
        <div className="flex-[1] flex flex-col border-l border-zinc-800 min-w-0">
          {/* Next preview: next animation step or next slide */}
          <div className="flex flex-col items-center justify-center p-3 border-b border-zinc-800 shrink-0">
            <div className="text-xs font-semibold text-zinc-500 mb-1.5 uppercase tracking-wider">
              {activeStep < steps.length
                ? `Next Step (${activeStep + 1}/${steps.length})`
                : "Next Slide"}
            </div>
            {activeStep < steps.length ? (
              <SlideRenderer
                slide={slide}
                scale={nextScale}
                animate
                activeStep={activeStep + 1}
                steps={steps}
                theme={deck.theme}
              />
            ) : nextSlide ? (
              <SlideRenderer
                slide={nextSlide}
                scale={nextScale}
                thumbnail
                theme={deck.theme}
              />
            ) : (
              <div
                className="flex items-center justify-center bg-zinc-900 text-zinc-600 text-sm rounded"
                style={{
                  width: CANVAS_WIDTH * nextScale,
                  height: CANVAS_HEIGHT * nextScale,
                }}
              >
                End of presentation
              </div>
            )}
          </div>

          {/* Speaker notes with animation-aware highlighting */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">
              Notes
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {noteSegments.length === 0 ? (
                <span className="text-zinc-600 italic">
                  No notes for this slide
                </span>
              ) : (
                noteSegments.map((seg, i) => {
                  if (seg.step === null) {
                    return (
                      <span key={i} className="text-zinc-300">
                        {seg.text}
                      </span>
                    );
                  }
                  const isActive = activeStep >= seg.step;
                  return (
                    <span
                      key={i}
                      className={
                        isActive
                          ? "text-yellow-300 bg-yellow-900/30 rounded px-0.5"
                          : "text-zinc-500"
                      }
                    >
                      {seg.text}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="h-11 border-t border-zinc-800 flex items-center justify-between px-6 shrink-0 text-sm">
        {/* Left: slide/step counters */}
        <div className="text-zinc-400">
          Slide{" "}
          <span className="text-white font-semibold">
            {currentSlideIndex + 1}
          </span>
          <span className="text-zinc-600">/{totalSlides}</span>
          {steps.length > 0 && (
            <>
              <span className="mx-3 text-zinc-700">|</span>
              Step{" "}
              <span className="text-white font-semibold">{activeStep}</span>
              <span className="text-zinc-600">/{steps.length}</span>
            </>
          )}
        </div>

        {/* Center: controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPointerToggle}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              pointerActive
                ? "bg-red-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
            title="Toggle laser pointer (L)"
          >
            Pointer
          </button>
          <button
            onClick={onToggleViewMode}
            className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Switch to slide-only view (P)"
          >
            Slide Only
          </button>
          <button
            onClick={onOpenAudienceWindow}
            className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Open audience window (W)"
          >
            Pop Out
          </button>
          <span className="text-[10px] text-zinc-600 ml-2">
            P view / W pop out / L pointer / Esc exit
          </span>
        </div>

        {/* Right: timer */}
        <div className="font-mono text-zinc-300 text-base">{mm}:{ss}</div>
      </div>
    </div>
  );
}

// ── Audience Slide Viewer (slides-only, used in toggle mode) ──────

function AudienceSlideViewer({
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
  const transition: SlideTransition = slide.transition ?? {
    type: "fade",
    duration: 300,
  };
  const variant =
    transitionVariants[transition.type] ?? transitionVariants.fade;

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
