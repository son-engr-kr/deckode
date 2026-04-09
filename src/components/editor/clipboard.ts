import type { Slide, SlideElement } from "@/types/deck";

// Module-level clipboards (not in store — not undoable)
export let elementClipboard: SlideElement[] | null = null;
export let slideClipboard: Slide[] | null = null;
export let componentClipboard: string | null = null;

export function setElementClipboard(v: SlideElement[] | null) { elementClipboard = v; }
export function setSlideClipboard(v: Slide[] | null) { slideClipboard = v; }
export function setComponentClipboard(v: string | null) { componentClipboard = v; }
