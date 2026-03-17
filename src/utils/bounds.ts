import type { SlideElement, ShapeElement } from "@/types/deck";

/** Get the effective axis-aligned bounding box of a single element,
 *  accounting for waypoints on line/arrow shapes. */
export function getElementBounds(el: SlideElement): { x1: number; y1: number; x2: number; y2: number } {
  let ex1 = el.position.x;
  let ey1 = el.position.y;
  let ex2 = el.position.x + el.size.w;
  let ey2 = el.position.y + el.size.h;

  if (el.type === "shape") {
    const shape = el as ShapeElement;
    if ((shape.shape === "line" || shape.shape === "arrow") && shape.style?.waypoints && shape.style.waypoints.length >= 2) {
      const wps = shape.style.waypoints;
      let wMinX = Infinity, wMinY = Infinity, wMaxX = -Infinity, wMaxY = -Infinity;
      for (const p of wps) {
        wMinX = Math.min(wMinX, p.x);
        wMinY = Math.min(wMinY, p.y);
        wMaxX = Math.max(wMaxX, p.x);
        wMaxY = Math.max(wMaxY, p.y);
      }
      ex1 = el.position.x + wMinX;
      ey1 = el.position.y + wMinY;
      ex2 = el.position.x + wMaxX;
      ey2 = el.position.y + wMaxY;
    }
  }

  return { x1: ex1, y1: ey1, x2: ex2, y2: ey2 };
}

/** Compute the axis-aligned bounding box of a set of elements. */
export function computeBounds(elements: SlideElement[]): { x: number; y: number; w: number; h: number } {
  if (elements.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const el of elements) {
    const b = getElementBounds(el);
    x1 = Math.min(x1, b.x1);
    y1 = Math.min(y1, b.y1);
    x2 = Math.max(x2, b.x2);
    y2 = Math.max(y2, b.y2);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
