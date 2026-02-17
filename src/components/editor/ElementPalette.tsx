import { useState, useRef, useEffect } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { nextElementId } from "@/utils/id";
import type { SlideElement } from "@/types/deck";

const ELEMENT_PRESETS: { label: string; create: () => SlideElement }[] = [
  {
    label: "Text",
    create: () => ({
      id: nextElementId(),
      type: "text" as const,
      content: "New text",
      position: { x: 60, y: 200 },
      size: { w: 400, h: 100 },
      style: { fontSize: 24, color: "#ffffff" },
    }),
  },
  {
    label: "Code",
    create: () => ({
      id: nextElementId(),
      type: "code" as const,
      language: "typescript",
      content: "// your code here",
      position: { x: 60, y: 200 },
      size: { w: 500, h: 150 },
      style: { fontSize: 16, borderRadius: 8 },
    }),
  },
  {
    label: "Shape",
    create: () => ({
      id: nextElementId(),
      type: "shape" as const,
      shape: "rectangle" as const,
      position: { x: 200, y: 200 },
      size: { w: 200, h: 120 },
      style: { fill: "#3b82f6", borderRadius: 8 },
    }),
  },
  {
    label: "Image",
    create: () => ({
      id: nextElementId(),
      type: "image" as const,
      src: "",
      position: { x: 200, y: 150 },
      size: { w: 300, h: 200 },
      style: { objectFit: "contain" as const },
    }),
  },
  {
    label: "Video",
    create: () => ({
      id: nextElementId(),
      type: "video" as const,
      src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      position: { x: 200, y: 110 },
      size: { w: 560, h: 315 },
      controls: true,
      muted: true,
    }),
  },
  {
    label: "TikZ",
    create: () => ({
      id: nextElementId(),
      type: "tikz" as const,
      content: "\\begin{tikzpicture}\n  \\draw[thick, blue] (0,0) -- (3,2) -- (1,3) -- cycle;\n\\end{tikzpicture}",
      position: { x: 200, y: 100 },
      size: { w: 400, h: 300 },
    }),
  },
];

export function ElementPalette() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const addElement = useDeckStore((s) => s.addElement);
  const selectElement = useDeckStore((s) => s.selectElement);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!deck) return null;
  const slide = deck.slides[currentSlideIndex];
  if (!slide) return null;

  const handleAdd = (preset: (typeof ELEMENT_PRESETS)[number]) => {
    const element = preset.create();
    addElement(slide.id, element);
    selectElement(element.id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`text-xs px-2 py-1 rounded transition-colors ${
          open ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
        }`}
      >
        + Element
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 bg-zinc-800 border border-zinc-700 rounded shadow-lg z-50 py-1 min-w-[120px]">
          {ELEMENT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleAdd(preset)}
              className="block w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
