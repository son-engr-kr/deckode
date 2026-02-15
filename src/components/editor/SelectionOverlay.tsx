import { useRef, useCallback } from "react";
import { useDeckStore } from "@/stores/deckStore";
import type { Slide, SlideElement } from "@/types/deck";

interface Props {
  slide: Slide;
  scale: number;
}

export function SelectionOverlay({ slide, scale }: Props) {
  const selectedElementId = useDeckStore((s) => s.selectedElementId);
  const selectElement = useDeckStore((s) => s.selectElement);
  const updateElement = useDeckStore((s) => s.updateElement);

  return (
    <div
      className="absolute inset-0"
      style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
    >
      {slide.elements.map((element) => (
        <DraggableElement
          key={element.id}
          element={element}
          slideId={slide.id}
          isSelected={element.id === selectedElementId}
          onSelect={() => selectElement(element.id)}
          onMove={(dx, dy) => {
            updateElement(slide.id, element.id, {
              position: {
                x: element.position.x + dx,
                y: element.position.y + dy,
              },
            } as Partial<SlideElement>);
          }}
          scale={scale}
        />
      ))}
    </div>
  );
}

interface DraggableProps {
  element: SlideElement;
  slideId: string;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (dx: number, dy: number) => void;
  scale: number;
}

function DraggableElement({ element, isSelected, onSelect, onMove, scale }: DraggableProps) {
  const dragStart = useRef<{ x: number; y: number; ex: number; ey: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect();
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        ex: element.position.x,
        ey: element.position.y,
      };

      const handleMouseMove = (me: MouseEvent) => {
        if (!dragStart.current) return;
        const dx = (me.clientX - dragStart.current.x) / scale;
        const dy = (me.clientY - dragStart.current.y) / scale;
        onMove(
          Math.round(dragStart.current.ex + dx - element.position.x),
          Math.round(dragStart.current.ey + dy - element.position.y),
        );
      };

      const handleMouseUp = () => {
        dragStart.current = null;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [element.position.x, element.position.y, scale, onSelect, onMove],
  );

  return (
    <div
      className={`absolute cursor-move ${
        isSelected ? "ring-2 ring-blue-500 ring-offset-0" : "hover:ring-1 hover:ring-blue-400/50"
      }`}
      style={{
        left: element.position.x,
        top: element.position.y,
        width: element.size.w,
        height: element.size.h,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Transparent overlay to capture mouse events */}
      <div className="absolute inset-0" />

      {/* Resize handles (when selected) */}
      {isSelected && (
        <>
          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-nw-resize" />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-ne-resize" />
          <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-sw-resize" />
          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full cursor-se-resize" />
        </>
      )}
    </div>
  );
}
