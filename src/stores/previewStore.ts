import { create } from "zustand";
import type { Animation } from "@/types/deck";

interface PreviewState {
  animations: Animation[] | null;
  delayOverrides: Map<Animation, number> | null;
  /** Timestamps (ms from preview start) where onClick/onKey steps fire */
  flashTimes: number[];
  key: number;
  startPreview: (
    animations: Animation[],
    delayOverrides?: Map<Animation, number>,
    flashTimes?: number[],
  ) => void;
  clearPreview: () => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  animations: null,
  delayOverrides: null,
  flashTimes: [],
  key: 0,
  startPreview: (animations, delayOverrides, flashTimes) =>
    set((s) => ({
      animations,
      delayOverrides: delayOverrides ?? null,
      flashTimes: flashTimes ?? [],
      key: s.key + 1,
    })),
  clearPreview: () => set({ animations: null, delayOverrides: null, flashTimes: [] }),
}));
