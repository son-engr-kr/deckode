import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { subscribeWithSelector } from "zustand/middleware";
import type { Deck, Slide, SlideElement } from "@/types/deck";
import { saveDeckToDisk } from "@/utils/api";

interface DeckState {
  deck: Deck | null;
  currentSlideIndex: number;
  selectedElementId: string | null;
  isDirty: boolean;
  isSaving: boolean;

  // Actions
  loadDeck: (deck: Deck) => void;
  saveToDisk: () => Promise<void>;
  setCurrentSlide: (index: number) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  selectElement: (id: string | null) => void;
  updateElement: (slideId: string, elementId: string, patch: Partial<SlideElement>) => void;
  updateSlide: (slideId: string, patch: Partial<Slide>) => void;
  addSlide: (slide: Slide, afterIndex?: number) => void;
  deleteSlide: (slideId: string) => void;
  addElement: (slideId: string, element: SlideElement) => void;
  deleteElement: (slideId: string, elementId: string) => void;
}

export const useDeckStore = create<DeckState>()(
  subscribeWithSelector(
  immer((set, get) => ({
    deck: null,
    currentSlideIndex: 0,
    selectedElementId: null,
    isDirty: false,
    isSaving: false,

    loadDeck: (deck) =>
      set((state) => {
        state.deck = deck;
        state.currentSlideIndex = 0;
        state.selectedElementId = null;
        state.isDirty = false;
      }),

    saveToDisk: async () => {
      const { deck, isSaving } = get();
      if (!deck || isSaving) return;
      set((state) => { state.isSaving = true; });
      await saveDeckToDisk(deck);
      set((state) => { state.isSaving = false; state.isDirty = false; });
    },

    setCurrentSlide: (index) =>
      set((state) => {
        assert(state.deck !== null, "No deck loaded");
        assert(index >= 0 && index < state.deck.slides.length, `Slide index ${index} out of bounds`);
        state.currentSlideIndex = index;
        state.selectedElementId = null;
      }),

    nextSlide: () =>
      set((state) => {
        if (!state.deck) return;
        if (state.currentSlideIndex < state.deck.slides.length - 1) {
          state.currentSlideIndex += 1;
          state.selectedElementId = null;
        }
      }),

    prevSlide: () =>
      set((state) => {
        if (!state.deck) return;
        if (state.currentSlideIndex > 0) {
          state.currentSlideIndex -= 1;
          state.selectedElementId = null;
        }
      }),

    selectElement: (id) =>
      set((state) => {
        state.selectedElementId = id;
      }),

    updateElement: (slideId, elementId, patch) =>
      set((state) => {
        assert(state.deck !== null, "No deck loaded");
        const slide = state.deck.slides.find((s) => s.id === slideId);
        assert(slide !== undefined, `Slide ${slideId} not found`);
        const element = slide.elements.find((e) => e.id === elementId);
        assert(element !== undefined, `Element ${elementId} not found in slide ${slideId}`);
        Object.assign(element, patch);
        state.isDirty = true;
      }),

    updateSlide: (slideId, patch) =>
      set((state) => {
        assert(state.deck !== null, "No deck loaded");
        const slide = state.deck.slides.find((s) => s.id === slideId);
        assert(slide !== undefined, `Slide ${slideId} not found`);
        Object.assign(slide, patch);
        state.isDirty = true;
      }),

    addSlide: (slide, afterIndex) =>
      set((state) => {
        assert(state.deck !== null, "No deck loaded");
        const idx = afterIndex ?? state.deck.slides.length;
        state.deck.slides.splice(idx + 1, 0, slide);
        state.isDirty = true;
      }),

    deleteSlide: (slideId) =>
      set((state) => {
        assert(state.deck !== null, "No deck loaded");
        const idx = state.deck.slides.findIndex((s) => s.id === slideId);
        assert(idx !== -1, `Slide ${slideId} not found`);
        state.deck.slides.splice(idx, 1);
        if (state.currentSlideIndex >= state.deck.slides.length) {
          state.currentSlideIndex = Math.max(0, state.deck.slides.length - 1);
        }
        state.isDirty = true;
      }),

    addElement: (slideId, element) =>
      set((state) => {
        assert(state.deck !== null, "No deck loaded");
        const slide = state.deck.slides.find((s) => s.id === slideId);
        assert(slide !== undefined, `Slide ${slideId} not found`);
        slide.elements.push(element);
        state.isDirty = true;
      }),

    deleteElement: (slideId, elementId) =>
      set((state) => {
        assert(state.deck !== null, "No deck loaded");
        const slide = state.deck.slides.find((s) => s.id === slideId);
        assert(slide !== undefined, `Slide ${slideId} not found`);
        const idx = slide.elements.findIndex((e) => e.id === elementId);
        assert(idx !== -1, `Element ${elementId} not found in slide ${slideId}`);
        slide.elements.splice(idx, 1);
        if (state.selectedElementId === elementId) {
          state.selectedElementId = null;
        }
        state.isDirty = true;
      }),
  }))),
);

// Auto-save: debounce 1s after any mutation
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

useDeckStore.subscribe(
  (s) => s.isDirty,
  (isDirty) => {
    if (!isDirty) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      useDeckStore.getState().saveToDisk();
    }, 1000);
  },
);

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[DeckStore] ${message}`);
}
