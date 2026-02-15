import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { subscribeWithSelector } from "zustand/middleware";
import { temporal } from "zundo";
import type { Deck, Slide, SlideElement } from "@/types/deck";
import { saveDeckToDisk } from "@/utils/api";
import { nextElementId } from "@/utils/id";

interface DeckState {
  deck: Deck | null;
  currentSlideIndex: number;
  selectedElementId: string | null;
  isDirty: boolean;
  isSaving: boolean;

  loadDeck: (deck: Deck) => void;
  replaceDeck: (deck: Deck) => void;
  saveToDisk: () => Promise<void>;
  setCurrentSlide: (index: number) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  selectElement: (id: string | null) => void;
  updateElement: (slideId: string, elementId: string, patch: Partial<SlideElement>) => void;
  updateSlide: (slideId: string, patch: Partial<Slide>) => void;
  addSlide: (slide: Slide, afterIndex?: number) => void;
  deleteSlide: (slideId: string) => void;
  moveSlide: (fromIndex: number, toIndex: number) => void;
  addElement: (slideId: string, element: SlideElement) => void;
  deleteElement: (slideId: string, elementId: string) => void;
  duplicateElement: (slideId: string, elementId: string) => void;
}

export const useDeckStore = create<DeckState>()(
  subscribeWithSelector(
    temporal(
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

        replaceDeck: (deck) =>
          set((state) => {
            state.deck = deck;
            // Clamp slide index if slides were removed
            if (state.currentSlideIndex >= deck.slides.length) {
              state.currentSlideIndex = Math.max(0, deck.slides.length - 1);
            }
            state.isDirty = true;
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

        moveSlide: (fromIndex, toIndex) =>
          set((state) => {
            assert(state.deck !== null, "No deck loaded");
            const slides = state.deck.slides;
            assert(fromIndex >= 0 && fromIndex < slides.length, `fromIndex ${fromIndex} out of bounds`);
            assert(toIndex >= 0 && toIndex < slides.length, `toIndex ${toIndex} out of bounds`);
            const [moved] = slides.splice(fromIndex, 1);
            slides.splice(toIndex, 0, moved!);
            // Keep viewing the same slide that was moved
            if (state.currentSlideIndex === fromIndex) {
              state.currentSlideIndex = toIndex;
            } else if (fromIndex < state.currentSlideIndex && toIndex >= state.currentSlideIndex) {
              state.currentSlideIndex -= 1;
            } else if (fromIndex > state.currentSlideIndex && toIndex <= state.currentSlideIndex) {
              state.currentSlideIndex += 1;
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

        duplicateElement: (slideId, elementId) =>
          set((state) => {
            assert(state.deck !== null, "No deck loaded");
            const slide = state.deck.slides.find((s) => s.id === slideId);
            assert(slide !== undefined, `Slide ${slideId} not found`);
            const element = slide.elements.find((e) => e.id === elementId);
            assert(element !== undefined, `Element ${elementId} not found in slide ${slideId}`);
            const clone = JSON.parse(JSON.stringify(element)) as SlideElement;
            clone.id = nextElementId();
            clone.position = { x: element.position.x + 20, y: element.position.y + 20 };
            slide.elements.push(clone);
            state.selectedElementId = clone.id;
            state.isDirty = true;
          }),
      })),
      {
        partialize: (state) => ({ deck: state.deck }),
        limit: 50,
        // Skip recording when deck didn't change (e.g. saveToDisk, selectElement)
        equality: (pastState, currentState) => pastState.deck === currentState.deck,
        // Debounce: batch rapid changes (drag, typing) into one undo checkpoint.
        // Captures the state BEFORE the first change in a batch.
        handleSet: (handleSetImpl) => {
          let timeout: ReturnType<typeof setTimeout> | null = null;
          let batchStartState: Parameters<typeof handleSetImpl>[0] | null = null;
          return (state: Parameters<typeof handleSetImpl>[0]) => {
            if (batchStartState === null) {
              batchStartState = state;
            }
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
              handleSetImpl(batchStartState!);
              batchStartState = null;
              timeout = null;
            }, 500);
          };
        },
      },
    ),
  ),
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
