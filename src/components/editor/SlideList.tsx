import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";

const THUMB_SCALE = 0.15;

export function SlideList() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const setCurrentSlide = useDeckStore((s) => s.setCurrentSlide);

  if (!deck) return null;

  return (
    <div className="flex flex-col gap-2 p-2 overflow-y-auto">
      {deck.slides.map((slide, index) => (
        <button
          key={slide.id}
          onClick={() => setCurrentSlide(index)}
          className={`relative rounded border-2 transition-colors ${
            index === currentSlideIndex
              ? "border-blue-500"
              : "border-zinc-700 hover:border-zinc-500"
          }`}
          style={{
            width: 960 * THUMB_SCALE + 8,
            height: 540 * THUMB_SCALE + 8,
            padding: 2,
          }}
        >
          <div className="overflow-hidden rounded-sm pointer-events-none">
            <SlideRenderer slide={slide} scale={THUMB_SCALE} />
          </div>
          <span className="absolute bottom-0.5 right-1.5 text-[10px] text-zinc-500 font-mono">
            {index + 1}
          </span>
        </button>
      ))}
    </div>
  );
}
