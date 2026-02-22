import { useDeckStore } from "@/stores/deckStore";
import { usePreviewStore } from "@/stores/previewStore";
import type { Animation, AnimationEffect, AnimationTrigger } from "@/types/deck";

const EFFECTS: AnimationEffect[] = [
  "fadeIn", "fadeOut",
  "slideInLeft", "slideInRight", "slideInUp", "slideInDown",
  "scaleIn", "scaleOut",
  "typewriter",
];

const TRIGGERS: AnimationTrigger[] = ["onEnter", "onClick", "onKey", "afterPrevious", "withPrevious"];

interface AnimationEditorProps {
  slideId: string;
  elementId: string;
  animations: Animation[];
}

export function AnimationEditor({ slideId, elementId, animations }: AnimationEditorProps) {
  const addAnimation = useDeckStore((s) => s.addAnimation);
  const updateAnimation = useDeckStore((s) => s.updateAnimation);
  const deleteAnimation = useDeckStore((s) => s.deleteAnimation);
  const startPreview = usePreviewStore((s) => s.startPreview);

  // Build list of (globalIndex, animation) for entries targeting this element
  const entries: { globalIndex: number; animation: Animation }[] = [];
  for (let i = 0; i < animations.length; i++) {
    if (animations[i]!.target === elementId) {
      entries.push({ globalIndex: i, animation: animations[i]! });
    }
  }

  const handlePlayAll = () => {
    if (entries.length === 0) return;
    const anims = entries.map((e) => e.animation);
    const delays = new Map<Animation, number>();
    let cursor = 0;
    for (const anim of anims) {
      delays.set(anim, cursor + (anim.delay ?? 0));
      cursor += (anim.delay ?? 0) + (anim.duration ?? 500);
    }
    startPreview(anims, delays);
  };

  const handleAdd = () => {
    addAnimation(slideId, {
      target: elementId,
      trigger: "onEnter",
      effect: "fadeIn",
      duration: 500,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-zinc-400 text-xs uppercase tracking-wider">Animations</div>
        {entries.length > 1 && (
          <button
            className="text-zinc-500 hover:text-green-400 text-xs px-1.5 py-0.5 border border-zinc-700 hover:border-green-400/50 rounded transition-colors"
            onClick={handlePlayAll}
            title="Play all animations in order"
          >
            ▶ All
          </button>
        )}
      </div>

      {entries.length === 0 && (
        <div className="text-zinc-600 text-xs mb-2">No animations</div>
      )}

      <div className="space-y-2">
        {entries.map(({ globalIndex, animation }, localIndex) => (
          <div
            key={globalIndex}
            className="bg-zinc-800/50 border border-zinc-700 rounded p-2 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-xs font-mono">
                #{localIndex + 1}
                <span className="text-zinc-600 ml-1" title="Global index in slide animations">
                  (slide #{globalIndex + 1})
                </span>
              </span>
              <button
                className="text-zinc-500 hover:text-green-400 text-xs px-1"
                onClick={() => startPreview([animation])}
                title="Preview animation"
              >
                ▶
              </button>
              <button
                className="text-zinc-500 hover:text-red-400 text-xs px-1"
                onClick={() => deleteAnimation(slideId, globalIndex)}
                title="Delete animation"
              >
                ×
              </button>
            </div>

            {/* Effect */}
            <label className="flex items-center gap-2">
              <span className="text-zinc-500 text-xs w-14">Effect</span>
              <select
                className="flex-1 bg-zinc-800 text-zinc-200 rounded px-1.5 py-0.5 text-xs border border-zinc-700 focus:border-blue-500 focus:outline-none"
                value={animation.effect}
                onChange={(e) => updateAnimation(slideId, globalIndex, { effect: e.target.value as AnimationEffect })}
              >
                {EFFECTS.map((ef) => (
                  <option key={ef} value={ef}>{ef}</option>
                ))}
              </select>
            </label>

            {/* Trigger */}
            <label className="flex items-center gap-2">
              <span className="text-zinc-500 text-xs w-14">Trigger</span>
              <select
                className="flex-1 bg-zinc-800 text-zinc-200 rounded px-1.5 py-0.5 text-xs border border-zinc-700 focus:border-blue-500 focus:outline-none"
                value={animation.trigger}
                onChange={(e) => updateAnimation(slideId, globalIndex, { trigger: e.target.value as AnimationTrigger })}
              >
                {TRIGGERS.map((tr) => (
                  <option key={tr} value={tr}>{tr}</option>
                ))}
              </select>
            </label>

            {/* Key (only for onKey trigger) */}
            {animation.trigger === "onKey" && (
              <label className="flex items-center gap-2">
                <span className="text-zinc-500 text-xs w-14">Key</span>
                <input
                  type="text"
                  className="flex-1 bg-zinc-800 text-zinc-200 rounded px-1.5 py-0.5 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none w-0"
                  value={animation.key ?? ""}
                  maxLength={1}
                  placeholder="e.g. q"
                  onChange={(e) => updateAnimation(slideId, globalIndex, { key: e.target.value || undefined })}
                />
              </label>
            )}

            {/* Order (only meaningful for onClick) */}
            {animation.trigger === "onClick" && (
              <label className="flex items-center gap-2">
                <span className="text-zinc-500 text-xs w-14">Order</span>
                <input
                  type="number"
                  className="flex-1 bg-zinc-800 text-zinc-200 rounded px-1.5 py-0.5 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none w-0"
                  value={animation.order ?? ""}
                  min={0}
                  step={1}
                  placeholder="auto"
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    updateAnimation(slideId, globalIndex, {
                      order: val === "" ? undefined : parseInt(val, 10),
                    });
                  }}
                />
              </label>
            )}

            {/* Delay */}
            <label className="flex items-center gap-2">
              <span className="text-zinc-500 text-xs w-14">Delay</span>
              <input
                type="number"
                className="flex-1 bg-zinc-800 text-zinc-200 rounded px-1.5 py-0.5 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none w-0"
                value={animation.delay ?? 0}
                min={0}
                step={50}
                onChange={(e) => updateAnimation(slideId, globalIndex, { delay: parseInt(e.target.value, 10) || 0 })}
              />
              <span className="text-zinc-600 text-xs">ms</span>
            </label>

            {/* Duration */}
            <label className="flex items-center gap-2">
              <span className="text-zinc-500 text-xs w-14">Duration</span>
              <input
                type="number"
                className="flex-1 bg-zinc-800 text-zinc-200 rounded px-1.5 py-0.5 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none w-0"
                value={animation.duration ?? 500}
                min={0}
                step={50}
                onChange={(e) => updateAnimation(slideId, globalIndex, { duration: parseInt(e.target.value, 10) || 0 })}
              />
              <span className="text-zinc-600 text-xs">ms</span>
            </label>
          </div>
        ))}
      </div>

      <button
        className="mt-2 w-full text-xs text-zinc-400 hover:text-zinc-200 border border-dashed border-zinc-700 hover:border-zinc-500 rounded py-1.5 transition-colors"
        onClick={handleAdd}
      >
        + Add Animation
      </button>
    </div>
  );
}
