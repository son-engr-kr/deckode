import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Deck, Slide, SlideElement } from "@/types/deck";

interface DeckState {
  deck: Deck | null;
  currentSlideIndex: number;
  selectedElementId: string | null;

  // Actions
  loadDeck: (deck: Deck) => void;
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
  immer((set) => ({
    deck: null,
    currentSlideIndex: 0,
    selectedElementId: null,

    loadDeck: (deck) =>
      set((state) => {
        state.deck = deck;
        state.currentSlideIndex = 0;
        state.selectedElementId = null;
      }),

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
      }),

    updateSlide: (slideId, patch) =>
      set((state) => {
        assert(state.deck !== null, "No deck loaded");
        const slide = state.deck.slides.find((s) => s.id === slideId);
        assert(slide !== undefined, `Slide ${slideId} not found`);
        Object.assign(slide, patch);
      }),

    addSlide: (slide, afterIndex) =>
      set((state) => {
        assert(state.deck !== null, "No deck loaded");
        const idx = afterIndex ?? state.deck.slides.length;
        state.deck.slides.splice(idx + 1, 0, slide);
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
      }),

    addElement: (slideId, element) =>
      set((state) => {
        assert(state.deck !== null, "No deck loaded");
        const slide = state.deck.slides.find((s) => s.id === slideId);
        assert(slide !== undefined, `Slide ${slideId} not found`);
        slide.elements.push(element);
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
      }),
  })),
);

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[DeckStore] ${message}`);
}
