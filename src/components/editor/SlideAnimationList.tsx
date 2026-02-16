import { useDeckStore } from "@/stores/deckStore";
import type { AnimationEffect, AnimationTrigger } from "@/types/deck";

const EFFECTS: AnimationEffect[] = [
  "fadeIn", "fadeOut",
  "slideInLeft", "slideInRight", "slideInUp", "slideInDown",
  "scaleIn", "scaleOut",
  "typewriter",
];

const TRIGGERS: AnimationTrigger[] = ["onEnter", "onClick"];

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
      <div className="text-zinc-400 text-xs uppercase tracking-wider mb-2">
        Slide Animations
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

            {/* Timing + order row */}
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
