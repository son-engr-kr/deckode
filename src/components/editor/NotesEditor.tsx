import { useState } from "react";
import { useDeckStore } from "@/stores/deckStore";

export function NotesEditor() {
  const [expanded, setExpanded] = useState(false);
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const updateSlide = useDeckStore((s) => s.updateSlide);

  if (!deck) return null;
  const slide = deck.slides[currentSlideIndex];
  if (!slide) return null;

  return (
    <div className="border-t border-zinc-800 shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
          ▶
        </span>
        Notes
      </button>
      {expanded && (
        <div className="px-3 pb-2">
          <textarea
            className="w-full bg-zinc-800 text-zinc-200 rounded px-2 py-1.5 text-xs resize-y border border-zinc-700 focus:border-blue-500 focus:outline-none"
            style={{ height: 120 }}
            value={slide.notes ?? ""}
            placeholder="Presenter notes..."
            onChange={(e) => updateSlide(slide.id, { notes: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
