import { useDeckStore } from "@/stores/deckStore";
import { usePreviewStore } from "@/stores/previewStore";
import { computeSteps } from "@/utils/animationSteps";
import type { Animation, AnimationEffect, AnimationTrigger } from "@/types/deck";

const EFFECTS: AnimationEffect[] = [
  "fadeIn", "fadeOut",
  "slideInLeft", "slideInRight", "slideInUp", "slideInDown",
  "scaleIn", "scaleOut",
  "typewriter",
];

const TRIGGERS: AnimationTrigger[] = ["onEnter", "onClick", "onKey", "afterPrevious", "withPrevious"];

interface Props {
  onSelectElement: (elementId: string) => void;
}

export function SlideAnimationList({ onSelectElement }: Props) {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const addAnimation = useDeckStore((s) => s.addAnimation);
  const updateAnimation = useDeckStore((s) => s.updateAnimation);
  const deleteAnimation = useDeckStore((s) => s.deleteAnimation);
  const moveAnimation = useDeckStore((s) => s.moveAnimation);
  const startPreview = usePreviewStore((s) => s.startPreview);

  if (!deck) return null;

  const slide = deck.slides[currentSlideIndex]!;
  const animations = slide.animations ?? [];
  const elements = slide.elements;

  const handleAdd = () => {
    // Add animation targeting the first element (if any)
    const target = elements[0]?.id;
    if (!target) return;
    addAnimation(slide.id, {
      target,
      trigger: "onEnter",
      effect: "fadeIn",
      duration: 500,
    });
  };

  const handlePlayAll = () => {
    if (animations.length === 0) return;
    const delays = new Map<Animation, number>();
    const flashTimes: number[] = [];

    // onEnter animations play first with their original delays
    let onEnterEnd = 0;
    for (const anim of animations) {
      if (anim.trigger === "onEnter") {
        onEnterEnd = Math.max(onEnterEnd, (anim.delay ?? 0) + (anim.duration ?? 500));
      }
    }

    // Step-based animations play sequentially after onEnter completes
    const steps = computeSteps(animations);
    let cursor = onEnterEnd;
    for (const step of steps) {
      // Record flash time for onClick/onKey steps
      if (step.trigger === "onClick" || step.trigger === "onKey") {
        flashTimes.push(cursor);
      }
      let stepEnd = cursor;
      for (const anim of step.animations) {
        const stepDelay = step.delayOverrides.get(anim) ?? (anim.delay ?? 0);
        const totalDelay = cursor + stepDelay;
        delays.set(anim, totalDelay);
        stepEnd = Math.max(stepEnd, totalDelay + (anim.duration ?? 500));
      }
      cursor = stepEnd;
    }

    startPreview(animations, delays, flashTimes);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    moveAnimation(slide.id, index, index - 1);
  };

  const handleMoveDown = (index: number) => {
    if (index >= animations.length - 1) return;
    moveAnimation(slide.id, index, index + 1);
  };

  // Find element type+id label for a target
  const getTargetLabel = (targetId: string) => {
    const el = elements.find((e) => e.id === targetId);
    if (!el) return targetId;
    return `${el.type}/${el.id}`;
  };

  return (
    <div className="p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-zinc-400 text-xs uppercase tracking-wider">
          Slide Animations
        </div>
        {animations.length > 1 && (
          <button
            className="text-zinc-500 hover:text-green-400 text-xs px-1.5 py-0.5 border border-zinc-700 hover:border-green-400/50 rounded transition-colors"
            onClick={handlePlayAll}
            title="Play all animations in order"
          >
            ▶ All
          </button>
        )}
      </div>

      {animations.length === 0 && (
        <div className="text-zinc-600 text-xs">No animations on this slide</div>
      )}

      <div className="space-y-2">
        {animations.map((anim, index) => (
          <div
            key={index}
            className="bg-zinc-800/50 border border-zinc-700 rounded p-2 space-y-1.5"
          >
            {/* Header: index + target + actions */}
            <div className="flex items-center justify-between gap-1">
              <button
                className="flex-1 text-left text-zinc-300 text-xs font-mono truncate hover:text-blue-400 transition-colors"
                onClick={() => onSelectElement(anim.target)}
                title="Select element"
              >
                {index + 1}. [{anim.effect}] on {getTargetLabel(anim.target)}
              </button>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  className="text-zinc-600 hover:text-zinc-300 text-xs px-0.5"
                  onClick={() => handleMoveUp(index)}
                  title="Move up"
                  disabled={index === 0}
                >
                  ^
                </button>
                <button
                  className="text-zinc-600 hover:text-zinc-300 text-xs px-0.5"
                  onClick={() => handleMoveDown(index)}
                  title="Move down"
                  disabled={index === animations.length - 1}
                >
                  v
                </button>
                <button
                  className="text-zinc-500 hover:text-green-400 text-xs px-1"
                  onClick={() => startPreview([anim])}
                  title="Preview animation"
                >
                  ▶
                </button>
                <button
                  className="text-zinc-500 hover:text-red-400 text-xs px-1"
                  onClick={() => deleteAnimation(slide.id, index)}
                  title="Delete animation"
                >
                  x
                </button>
              </div>
            </div>

            {/* Details row */}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <select
                className="bg-zinc-800 text-zinc-300 rounded px-1 py-0.5 text-xs border border-zinc-700 focus:border-blue-500 focus:outline-none"
                value={anim.target}
                onChange={(e) => updateAnimation(slide.id, index, { target: e.target.value })}
              >
                {elements.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.type}/{el.id}
                  </option>
                ))}
              </select>

              <select
                className="bg-zinc-800 text-zinc-300 rounded px-1 py-0.5 text-xs border border-zinc-700 focus:border-blue-500 focus:outline-none"
                value={anim.trigger}
                onChange={(e) => updateAnimation(slide.id, index, { trigger: e.target.value as AnimationTrigger })}
              >
                {TRIGGERS.map((tr) => (
                  <option key={tr} value={tr}>{tr}</option>
                ))}
              </select>

              <select
                className="bg-zinc-800 text-zinc-300 rounded px-1 py-0.5 text-xs border border-zinc-700 focus:border-blue-500 focus:outline-none"
                value={anim.effect}
                onChange={(e) => updateAnimation(slide.id, index, { effect: e.target.value as AnimationEffect })}
              >
                {EFFECTS.map((ef) => (
                  <option key={ef} value={ef}>{ef}</option>
                ))}
              </select>
            </div>

            {/* Timing + order + key row */}
            <div className="flex items-center gap-2 text-xs">
              {anim.trigger === "onClick" && (
                <label className="flex items-center gap-1">
                  <span className="text-zinc-500">ord</span>
                  <input
                    type="number"
                    className="w-10 bg-zinc-800 text-zinc-200 rounded px-1 py-0.5 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none"
                    value={anim.order ?? ""}
                    min={0}
                    step={1}
                    placeholder="-"
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      updateAnimation(slide.id, index, {
                        order: val === "" ? undefined : parseInt(val, 10),
                      });
                    }}
                  />
                </label>
              )}
              {anim.trigger === "onKey" && (
                <label className="flex items-center gap-1">
                  <span className="text-zinc-500">key</span>
                  <input
                    type="text"
                    className="w-10 bg-zinc-800 text-zinc-200 rounded px-1 py-0.5 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none"
                    value={anim.key ?? ""}
                    maxLength={1}
                    placeholder="-"
                    onChange={(e) => updateAnimation(slide.id, index, { key: e.target.value || undefined })}
                  />
                </label>
              )}
              <label className="flex items-center gap-1">
                <span className="text-zinc-500">delay</span>
                <input
                  type="number"
                  className="w-14 bg-zinc-800 text-zinc-200 rounded px-1 py-0.5 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none"
                  value={anim.delay ?? 0}
                  min={0}
                  step={50}
                  onChange={(e) => updateAnimation(slide.id, index, { delay: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
              <label className="flex items-center gap-1">
                <span className="text-zinc-500">dur</span>
                <input
                  type="number"
                  className="w-14 bg-zinc-800 text-zinc-200 rounded px-1 py-0.5 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none"
                  value={anim.duration ?? 500}
                  min={0}
                  step={50}
                  onChange={(e) => updateAnimation(slide.id, index, { duration: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
              <span className="text-zinc-600 text-xs">ms</span>
            </div>
          </div>
        ))}
      </div>

      <button
        className="w-full text-xs text-zinc-400 hover:text-zinc-200 border border-dashed border-zinc-700 hover:border-zinc-500 rounded py-1.5 transition-colors"
        onClick={handleAdd}
        disabled={elements.length === 0}
      >
        + Add Animation
      </button>
    </div>
  );
}
