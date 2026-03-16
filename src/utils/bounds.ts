import type { SlideElement } from "@/types/deck";

/** Compute the axis-aligned bounding box of a set of elements. */
export function computeBounds(elements: SlideElement[]): { x: number; y: number; w: number; h: number } {
  if (elements.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const el of elements) {
    x1 = Math.min(x1, el.position.x);
    y1 = Math.min(y1, el.position.y);
    x2 = Math.max(x2, el.position.x + el.size.w);
    y2 = Math.max(y2, el.position.y + el.size.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
