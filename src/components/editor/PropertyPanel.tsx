import { useDeckStore } from "@/stores/deckStore";
import type { SlideElement } from "@/types/deck";

export function PropertyPanel() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const selectedElementId = useDeckStore((s) => s.selectedElementId);
  const updateElement = useDeckStore((s) => s.updateElement);

  if (!deck || selectedElementId === null) {
    return (
      <div className="p-4 text-zinc-500 text-sm">
        Select an element to edit its properties
      </div>
    );
  }

  const slide = deck.slides[currentSlideIndex]!;
  const element = slide.elements.find((e) => e.id === selectedElementId);
  if (!element) return null;

  const handleNumberChange = (
    path: "position.x" | "position.y" | "size.w" | "size.h",
    value: string,
  ) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;

    const [group, field] = path.split(".") as ["position" | "size", string];
    const updated = { [group]: { ...element[group], [field]: num } };
    updateElement(slide.id, element.id, updated as Partial<SlideElement>);
  };

  return (
    <div className="p-3 space-y-4 text-sm overflow-y-auto">
      {/* Element info */}
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Element</div>
        <div className="text-zinc-300 font-mono">
          {element.type} / {element.id}
        </div>
      </div>

      {/* Position */}
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Position</div>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="X" value={element.position.x} onChange={(v) => handleNumberChange("position.x", v)} />
          <NumberInput label="Y" value={element.position.y} onChange={(v) => handleNumberChange("position.y", v)} />
        </div>
      </div>

      {/* Size */}
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Size</div>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="W" value={element.size.w} onChange={(v) => handleNumberChange("size.w", v)} />
          <NumberInput label="H" value={element.size.h} onChange={(v) => handleNumberChange("size.h", v)} />
        </div>
      </div>

      {/* Content (for text/code) */}
      {("content" in element) && (
        <div>
          <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Content</div>
          <textarea
            className="w-full bg-zinc-800 text-zinc-200 rounded px-2 py-1.5 text-xs font-mono resize-y min-h-20 border border-zinc-700 focus:border-blue-500 focus:outline-none"
            value={element.content}
            rows={5}
            onChange={(e) => {
              updateElement(slide.id, element.id, { content: e.target.value } as Partial<SlideElement>);
            }}
          />
        </div>
      )}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-zinc-500 text-xs w-3">{label}</span>
      <input
        type="number"
        className="flex-1 bg-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none w-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
