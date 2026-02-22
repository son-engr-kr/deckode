import { useRef, useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { nextSlideId } from "@/utils/id";
import { useAdapter } from "@/contexts/AdapterContext";
import type { Slide, DeckTheme } from "@/types/deck";
import type { LayoutInfo } from "@/adapters/types";

const CANVAS_W = 960;
const CANVAS_H = 540;
// Chrome around each thumbnail: button border-2 (4px) + p-0.5 (4px)
const THUMB_CHROME = 8;
const DEFAULT_THUMB_SCALE = 0.15;
const MIN_THUMB_SCALE = 0.1;

function createBlankSlide(): Slide {
  return {
    id: nextSlideId(),
    background: { color: "#0f172a" },
    elements: [],
  };
}

export function SlideList() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const selectedSlideIds = useDeckStore((s) => s.selectedSlideIds);
  const setCurrentSlide = useDeckStore((s) => s.setCurrentSlide);
  const setSelectedSlides = useDeckStore((s) => s.setSelectedSlides);
  const addSlide = useDeckStore((s) => s.addSlide);
  const deleteSlide = useDeckStore((s) => s.deleteSlide);
  const moveSlide = useDeckStore((s) => s.moveSlide);
  const adapter = useAdapter();
  const listRef = useRef<HTMLDivElement>(null);
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);
  const [layouts, setLayouts] = useState<LayoutInfo[]>([]);
  const [thumbScale, setThumbScale] = useState(DEFAULT_THUMB_SCALE);

  // Require 5px movement before drag starts (so clicks still work)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Responsive thumbnail scale: observe container width
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) {
        setThumbScale(Math.max(MIN_THUMB_SCALE, (w - THUMB_CHROME) / CANVAS_W));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const thumbH = Math.round(CANVAS_H * thumbScale);

  // Load layouts when picker opens
  useEffect(() => {
    if (!showLayoutPicker) return;
    adapter.listLayouts().then(setLayouts);
  }, [showLayoutPicker, adapter]);

  // Auto-scroll to current slide
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const child = container.children[currentSlideIndex] as HTMLElement | undefined;
    child?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentSlideIndex]);

  if (!deck) return null;

  const handleAddSlide = () => {
    const slide = createBlankSlide();
    const lastIndex = deck.slides.length - 1;
    addSlide(slide, lastIndex);
    setCurrentSlide(lastIndex + 1);
  };

  const handleAddFromLayout = async (layoutName: string) => {
    const templateSlide = await adapter.loadLayout(layoutName);
    // Assign fresh IDs so multiple slides from the same layout don't collide
    const slideId = nextSlideId();
    const slide: Slide = {
      ...templateSlide,
      id: slideId,
      layout: layoutName,
      elements: templateSlide.elements.map((el: any) => ({
        ...el,
        id: `${slideId}-${el.id}`,
      })),
    };
    const lastIndex = deck.slides.length - 1;
    addSlide(slide, lastIndex);
    setCurrentSlide(lastIndex + 1);
    setShowLayoutPicker(false);
  };

  const handleDeleteSlide = (slideId: string, index: number) => {
    if (deck.slides.length <= 1) return;
    deleteSlide(slideId);
    if (index > 0) setCurrentSlide(index - 1);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = deck.slides.findIndex((s) => s.id === active.id);
    const toIndex = deck.slides.findIndex((s) => s.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      moveSlide(fromIndex, toIndex);
    }
  };

  const slideIds = deck.slides.map((s) => s.id);

  return (
    <div ref={listRef} className="flex flex-col gap-1.5 p-2 overflow-y-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={slideIds} strategy={verticalListSortingStrategy}>
          {deck.slides.map((slide, index) => (
            <SortableSlideItem
              key={slide.id}
              slide={slide}
              index={index}
              scale={thumbScale}
              isCurrent={index === currentSlideIndex}
              isSelected={selectedSlideIds.includes(slide.id)}
              canDelete={deck.slides.length > 1}
              onSelect={(e: React.MouseEvent) => {
                if (e.ctrlKey || e.metaKey) {
                  // Toggle in/out of selection
                  const newIds = selectedSlideIds.includes(slide.id)
                    ? selectedSlideIds.filter((id) => id !== slide.id)
                    : [...selectedSlideIds, slide.id];
                  setSelectedSlides(newIds.length > 0 ? newIds : [slide.id]);
                  useDeckStore.setState({ currentSlideIndex: index, selectedElementId: null });
                } else if (e.shiftKey) {
                  // Range select from currentSlideIndex to clicked index
                  const start = Math.min(currentSlideIndex, index);
                  const end = Math.max(currentSlideIndex, index);
                  const rangeIds = deck.slides.slice(start, end + 1).map((s) => s.id);
                  setSelectedSlides(rangeIds);
                  useDeckStore.setState({ currentSlideIndex: index, selectedElementId: null });
                } else {
                  setCurrentSlide(index);
                }
              }}
              onDelete={() => handleDeleteSlide(slide.id, index)}
              theme={deck.theme}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add slide buttons */}
      <div className="flex gap-1 shrink-0">
        <button
          onClick={handleAddSlide}
          className="flex-1 rounded border-2 border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center text-lg"
          style={{ height: thumbH + 6 }}
          title="Add blank slide"
        >
          +
        </button>
        <button
          onClick={() => setShowLayoutPicker(!showLayoutPicker)}
          className={`w-8 rounded border-2 transition-colors flex items-center justify-center text-[10px] ${
            showLayoutPicker
              ? "border-blue-500 text-blue-400"
              : "border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300"
          }`}
          style={{ height: thumbH + 6 }}
          title="Add from layout"
        >
          L
        </button>
      </div>

      {/* Layout picker dropdown */}
      {showLayoutPicker && (
        <div className="shrink-0 rounded bg-zinc-900 border border-zinc-700 p-1.5">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 px-1">Layouts</div>
          {layouts.length === 0 && (
            <div className="text-[10px] text-zinc-600 px-1">No layouts found</div>
          )}
          {layouts.map((layout) => (
            <button
              key={layout.name}
              onClick={() => handleAddFromLayout(layout.name)}
              className="w-full text-left text-[11px] px-1.5 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              {layout.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortableSlideItem({
  slide,
  index,
  scale,
  isCurrent,
  isSelected,
  canDelete,
  onSelect,
  onDelete,
  theme,
}: {
  slide: Slide;
  index: number;
  scale: number;
  isCurrent: boolean;
  isSelected: boolean;
  canDelete: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDelete: () => void;
  theme?: DeckTheme;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group shrink-0">
      <button
        onClick={onSelect}
        className={`rounded border-2 transition-colors p-0.5 ${
          isCurrent
            ? "border-blue-500"
            : isSelected
              ? "border-blue-400/60"
              : "border-zinc-700 hover:border-zinc-500"
        }`}
      >
        <div className="rounded-sm overflow-hidden pointer-events-none">
          <SlideRenderer slide={slide} scale={scale} thumbnail theme={theme} />
        </div>
        <span className="absolute bottom-0.5 right-1.5 text-[10px] text-zinc-500 font-mono">
          {index + 1}
        </span>
      </button>

      {canDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete slide"
        >
          ×
        </button>
      )}
    </div>
  );
}
