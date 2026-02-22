import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { usePresentationChannel } from "@/hooks/usePresentationChannel";
import { computeSteps } from "@/utils/animationSteps";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";

export function PresenterView() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const setCurrentSlide = useDeckStore((s) => s.setCurrentSlide);

  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const slide = deck?.slides[currentSlideIndex];
  const nextSlide = deck?.slides[currentSlideIndex + 1] ?? null;
  const totalSlides = deck?.slides.length ?? 0;

  const steps = useMemo(
    () => computeSteps(slide?.animations ?? []),
    [slide?.animations],
  );

  // Reset activeStep on slide change
  useEffect(() => {
    setActiveStep(0);
  }, [currentSlideIndex]);

  // Refs for stable keyboard handler
  const activeStepRef = useRef(activeStep);
  activeStepRef.current = activeStep;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const currentSlideIndexRef = useRef(currentSlideIndex);
  currentSlideIndexRef.current = currentSlideIndex;
  const totalSlidesRef = useRef(totalSlides);
  totalSlidesRef.current = totalSlides;

  // --- BroadcastChannel ---
  const skipNextBroadcast = useRef(false);

  const { postNavigate, postExit, postSyncRequest } = usePresentationChannel({
    onNavigate: (slideIndex, step) => {
      skipNextBroadcast.current = true;
      setCurrentSlide(slideIndex);
      setActiveStep(step);
    },
    onExit: () => {
      window.close();
    },
  });

  // Send sync-request on mount so the audience replies with its current state
  useEffect(() => {
    postSyncRequest();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcast navigation changes (skip if the change came from the channel)
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

  // --- Navigation ---
  const advance = useCallback(() => {
    if (activeStepRef.current < stepsRef.current.length) {
      setActiveStep((prev) => prev + 1);
    } else if (
      currentSlideIndexRef.current <
      totalSlidesRef.current - 1
    ) {
      setCurrentSlide(currentSlideIndexRef.current + 1);
    }
  }, [setCurrentSlide]);

  const goBack = useCallback(() => {
    if (activeStepRef.current > 0) {
      setActiveStep((prev) => prev - 1);
    } else if (currentSlideIndexRef.current > 0) {
      setCurrentSlide(currentSlideIndexRef.current - 1);
    }
  }, [setCurrentSlide]);

  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        postExit();
        window.close();
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        advanceRef.current();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
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
  }, [postExit, goBack]);

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // --- Scale ---
  const mainRef = useRef<HTMLDivElement>(null);
  const [currentScale, setCurrentScale] = useState(0.5);
  const [nextScale, setNextScale] = useState(0.25);

  useEffect(() => {
    const update = () => {
      if (!mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      // Current slide takes ~65% width, ~70% height
      const mainW = rect.width * 0.63;
      const mainH = rect.height * 0.72;
      setCurrentScale(
        Math.min(mainW / CANVAS_WIDTH, mainH / CANVAS_HEIGHT),
      );
      // Next slide preview is smaller
      const sideW = rect.width * 0.33;
      const sideH = rect.height * 0.35;
      setNextScale(
        Math.min(sideW / CANVAS_WIDTH, sideH / CANVAS_HEIGHT),
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!deck || !slide) return null;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div
      ref={mainRef}
      className="h-screen w-screen bg-zinc-950 text-white flex flex-col select-none"
    >
      {/* Top area: current slide + right sidebar */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Current slide (large) */}
        <div className="flex-[2] flex items-center justify-center p-4">
          <SlideRenderer
            slide={slide}
            scale={currentScale}
            animate
            activeStep={activeStep}
            steps={steps}
            onAdvance={advance}
            theme={deck.theme}
          />
        </div>

        {/* Right sidebar: next slide + notes */}
        <div className="flex-[1] flex flex-col border-l border-zinc-800 min-w-0">
          {/* Next slide preview */}
          <div className="flex items-center justify-center p-3 border-b border-zinc-800 shrink-0">
            {nextSlide ? (
              <SlideRenderer
                slide={nextSlide}
                scale={nextScale}
                thumbnail
                theme={deck.theme}
              />
            ) : (
              <div
                className="flex items-center justify-center bg-zinc-900 text-zinc-600 text-sm"
                style={{
                  width: CANVAS_WIDTH * nextScale,
                  height: CANVAS_HEIGHT * nextScale,
                }}
              >
                End of presentation
              </div>
            )}
          </div>

          {/* Speaker notes */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">
              Notes
            </div>
            <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {slide.notes || (
                <span className="text-zinc-600 italic">No notes for this slide</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar: counters + timer */}
      <div className="h-10 border-t border-zinc-800 flex items-center justify-between px-6 shrink-0 text-sm">
        <div className="text-zinc-400">
          Slide{" "}
          <span className="text-white font-semibold">{currentSlideIndex + 1}</span>
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
        <div className="font-mono text-zinc-300 text-base">
          {mm}:{ss}
        </div>
      </div>
    </div>
  );
}
