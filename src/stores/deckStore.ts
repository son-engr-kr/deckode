import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { subscribeWithSelector } from "zustand/middleware";
import { temporal } from "zundo";
import type { Animation, Deck, Slide, SlideElement } from "@/types/deck";
import { saveDeckToDisk } from "@/utils/api";
import { nextElementId } from "@/utils/id";

interface DeckState {
  currentProject: string | null;
  deck: Deck | null;
  currentSlideIndex: number;
  selectedElementId: string | null;
  highlightedElementIds: string[];
  isDirty: boolean;
  isSaving: boolean;

  openProject: (project: string, deck: Deck) => void;
  closeProject: () => void;
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
  addAnimation: (slideId: string, animation: Animation) => void;
  updateAnimation: (slideId: string, index: number, patch: Partial<Animation>) => void;
  deleteAnimation: (slideId: string, index: number) => void;
  moveAnimation: (slideId: string, fromIndex: number, toIndex: number) => void;
  highlightElements: (ids: string[]) => void;
}

let highlightTimer: ReturnType<typeof setTimeout> | null = null;
let isDragging = false;

// Hoisted so we can cancel the pending batch on project switch
let batchTimeout: ReturnType<typeof setTimeout> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let batchStartState: any = null;

export function setDeckDragging(active: boolean) {
  isDragging = active;
}

export const useDeckStore = create<DeckState>()(
  subscribeWithSelector(
    temporal(
      immer((set, get) => ({
        currentProject: null,
        deck: null,
        currentSlideIndex: 0,
        selectedElementId: null,
        highlightedElementIds: [],
        isDirty: false,
        isSaving: false,

        openProject: (project, deck) =>
          set((state) => {
            state.currentProject = project;
            state.deck = deck;
            state.currentSlideIndex = 0;
            state.selectedElementId = null;
            state.isDirty = false;
          }),

        closeProject: () =>
          set((state) => {
            state.currentProject = null;
            state.deck = null;
            state.currentSlideIndex = 0;
            state.selectedElementId = null;
            state.isDirty = false;
          }),

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
          const { deck, isSaving, currentProject } = get();
          if (!deck || isSaving || !currentProject) return;
          set((state) => { state.isSaving = true; });
          await saveDeckToDisk(deck, currentProject);
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
            if (slide.animations) {
              slide.animations = slide.animations.filter(a => a.target !== elementId);
            }
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

        addAnimation: (slideId, animation) =>
          set((state) => {
            assert(state.deck !== null, "No deck loaded");
            const slide = state.deck.slides.find((s) => s.id === slideId);
            assert(slide !== undefined, `Slide ${slideId} not found`);
            if (!slide.animations) slide.animations = [];
            slide.animations.push(animation);
            state.isDirty = true;
          }),

        updateAnimation: (slideId, index, patch) =>
          set((state) => {
            assert(state.deck !== null, "No deck loaded");
            const slide = state.deck.slides.find((s) => s.id === slideId);
            assert(slide !== undefined, `Slide ${slideId} not found`);
            assert(slide.animations !== undefined && index >= 0 && index < slide.animations.length, `Animation index ${index} out of bounds`);
            Object.assign(slide.animations[index]!, patch);
            state.isDirty = true;
          }),

        deleteAnimation: (slideId, index) =>
          set((state) => {
            assert(state.deck !== null, "No deck loaded");
            const slide = state.deck.slides.find((s) => s.id === slideId);
            assert(slide !== undefined, `Slide ${slideId} not found`);
            assert(slide.animations !== undefined && index >= 0 && index < slide.animations.length, `Animation index ${index} out of bounds`);
            slide.animations.splice(index, 1);
            state.isDirty = true;
          }),

        moveAnimation: (slideId, fromIndex, toIndex) =>
          set((state) => {
            assert(state.deck !== null, "No deck loaded");
            const slide = state.deck.slides.find((s) => s.id === slideId);
            assert(slide !== undefined, `Slide ${slideId} not found`);
            assert(slide.animations !== undefined, `Slide ${slideId} has no animations`);
            const anims = slide.animations;
            assert(fromIndex >= 0 && fromIndex < anims.length, `fromIndex ${fromIndex} out of bounds`);
            assert(toIndex >= 0 && toIndex < anims.length, `toIndex ${toIndex} out of bounds`);
            const [moved] = anims.splice(fromIndex, 1);
            anims.splice(toIndex, 0, moved!);
            state.isDirty = true;
          }),

        highlightElements: (ids) => {
          if (highlightTimer) clearTimeout(highlightTimer);
          set((state) => { state.highlightedElementIds = ids; });
          highlightTimer = setTimeout(() => {
            set((state) => { state.highlightedElementIds = []; });
            highlightTimer = null;
          }, 800);
        },
      })),
      {
        partialize: (state) => ({ deck: state.deck }),
        limit: 50,
        // Skip recording when deck didn't change, OR when either side is null
        // (null↔deck transitions are project lifecycle, not undoable edits)
        equality: (pastState, currentState) =>
          pastState.deck === currentState.deck ||
          pastState.deck === null ||
          currentState.deck === null,
        // Debounce: batch rapid changes (drag, typing) into one undo checkpoint.
        // Captures the state BEFORE the first change in a batch.
        handleSet: (handleSetImpl) => {
          const tryFlush = () => {
            if (isDragging) {
              batchTimeout = setTimeout(tryFlush, 300);
              return;
            }
            handleSetImpl(batchStartState!);
            batchStartState = null;
            batchTimeout = null;
          };
          return (state: Parameters<typeof handleSetImpl>[0]) => {
            if (batchStartState === null) {
              batchStartState = state;
            }
            if (batchTimeout) clearTimeout(batchTimeout);
            batchTimeout = setTimeout(tryFlush, 300);
          };
        },
      },
    ),
  ),
);

// Clear undo history on project switch (open/close are not undoable)
useDeckStore.subscribe(
  (s) => s.currentProject,
  () => {
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
      batchStartState = null;
    }
    useDeckStore.temporal.getState().clear();
  },
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
