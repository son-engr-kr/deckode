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
        <InteractiveElement
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
          onResize={(dx, dy, dw, dh) => {
            updateElement(slide.id, element.id, {
              position: {
                x: element.position.x + dx,
                y: element.position.y + dy,
              },
              size: {
                w: Math.max(20, element.size.w + dw),
                h: Math.max(20, element.size.h + dh),
              },
            } as Partial<SlideElement>);
          }}
          scale={scale}
        />
      ))}
    </div>
  );
}

type Corner = "nw" | "ne" | "sw" | "se";

interface InteractiveProps {
  element: SlideElement;
  slideId: string;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (dx: number, dy: number) => void;
  onResize: (dx: number, dy: number, dw: number, dh: number) => void;
  scale: number;
}

function InteractiveElement({ element, isSelected, onSelect, onMove, onResize, scale }: InteractiveProps) {
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

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, corner: Corner) => {
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = element.position.x;
      const origY = element.position.y;
      const origW = element.size.w;
      const origH = element.size.h;

      const handleMouseMove = (me: MouseEvent) => {
        const rawDx = (me.clientX - startX) / scale;
        const rawDy = (me.clientY - startY) / scale;

        let dx = 0, dy = 0, dw = 0, dh = 0;
        switch (corner) {
          case "se":
            dw = Math.round(rawDx);
            dh = Math.round(rawDy);
            break;
          case "sw":
            dx = Math.round(rawDx);
            dw = -Math.round(rawDx);
            dh = Math.round(rawDy);
            break;
          case "ne":
            dy = Math.round(rawDy);
            dw = Math.round(rawDx);
            dh = -Math.round(rawDy);
            break;
          case "nw":
            dx = Math.round(rawDx);
            dy = Math.round(rawDy);
            dw = -Math.round(rawDx);
            dh = -Math.round(rawDy);
            break;
        }

        // Enforce minimum size
        const newW = origW + dw;
        const newH = origH + dh;
        if (newW < 20) { dw = 20 - origW; if (corner === "sw" || corner === "nw") dx = origW - 20; }
        if (newH < 20) { dh = 20 - origH; if (corner === "nw" || corner === "ne") dy = origH - 20; }

        onResize(
          (origX + dx) - element.position.x,
          (origY + dy) - element.position.y,
          (origW + dw) - element.size.w,
          (origH + dh) - element.size.h,
        );
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [element.position.x, element.position.y, element.size.w, element.size.h, scale, onResize],
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
          <ResizeHandle corner="nw" onMouseDown={handleResizeMouseDown} />
          <ResizeHandle corner="ne" onMouseDown={handleResizeMouseDown} />
          <ResizeHandle corner="sw" onMouseDown={handleResizeMouseDown} />
          <ResizeHandle corner="se" onMouseDown={handleResizeMouseDown} />
        </>
      )}
    </div>
  );
}

const HANDLE_POSITIONS: Record<Corner, string> = {
  nw: "-top-1 -left-1 cursor-nw-resize",
  ne: "-top-1 -right-1 cursor-ne-resize",
  sw: "-bottom-1 -left-1 cursor-sw-resize",
  se: "-bottom-1 -right-1 cursor-se-resize",
};

function ResizeHandle({
  corner,
  onMouseDown,
}: {
  corner: Corner;
  onMouseDown: (e: React.MouseEvent, corner: Corner) => void;
}) {
  return (
    <div
      className={`absolute w-2.5 h-2.5 bg-blue-500 rounded-full ${HANDLE_POSITIONS[corner]}`}
      onMouseDown={(e) => onMouseDown(e, corner)}
    />
  );
}
