import { create } from "zustand";
import { useDeckStore } from "./deckStore";

export interface SlideRef {
  slideId: string;
  slideIndex: number;
  slideTitle: string;
}

export interface ElementRef {
  elementId: string;
  slideId: string;
  type: string;
  label: string;
}

export interface ProjectRef {
  name: string;
  handle: FileSystemDirectoryHandle;
}

interface ContextBarState {
  slideRef: SlideRef | null;
  slideRefDismissed: boolean;
  elementRefs: ElementRef[];
  projectRefs: ProjectRef[];

  dismissSlideRef: () => void;
  addElementRef: (ref: ElementRef) => void;
  removeElementRef: (elementId: string) => void;
  addProjectRef: (ref: ProjectRef) => void;
  removeProjectRef: (name: string) => void;
  clearElementRefs: () => void;
}

/** Extract a short title from a slide's text elements. */
function getSlideTitle(slideIndex: number): string {
  const deck = useDeckStore.getState().deck;
  if (!deck) return `Slide ${slideIndex + 1}`;
  const slide = deck.slides[slideIndex];
  if (!slide) return `Slide ${slideIndex + 1}`;
  const textEl = slide.elements.find((e) => e.type === "text");
  if (textEl && "content" in textEl && typeof textEl.content === "string") {
    const preview = textEl.content.replace(/\n/g, " ").slice(0, 40);
    return preview || `Slide ${slideIndex + 1}`;
  }
  return `Slide ${slideIndex + 1}`;
}

export const useContextBarStore = create<ContextBarState>((set, get) => ({
  slideRef: null,
  slideRefDismissed: false,
  elementRefs: [],
  projectRefs: [],

  dismissSlideRef: () => set({ slideRefDismissed: true }),

  addElementRef: (ref) => {
    const existing = get().elementRefs;
    if (existing.some((r) => r.elementId === ref.elementId)) return;
    set({ elementRefs: [...existing, ref] });
  },

  removeElementRef: (elementId) =>
    set({ elementRefs: get().elementRefs.filter((r) => r.elementId !== elementId) }),

  addProjectRef: (ref) => {
    const existing = get().projectRefs;
    if (existing.some((r) => r.name === ref.name)) return;
    set({ projectRefs: [...existing, ref] });
  },

  removeProjectRef: (name) =>
    set({ projectRefs: get().projectRefs.filter((r) => r.name !== name) }),

  clearElementRefs: () => set({ elementRefs: [] }),
}));

// Subscribe to deckStore slide changes → auto-update slideRef
let prevSlideIndex = -1;
useDeckStore.subscribe((state) => {
  const { currentSlideIndex, deck } = state;
  if (currentSlideIndex === prevSlideIndex) return;
  prevSlideIndex = currentSlideIndex;

  if (!deck || currentSlideIndex < 0 || currentSlideIndex >= deck.slides.length) {
    useContextBarStore.setState({ slideRef: null, slideRefDismissed: false });
    return;
  }

  const slide = deck.slides[currentSlideIndex]!;
  useContextBarStore.setState({
    slideRef: {
      slideId: slide.id,
      slideIndex: currentSlideIndex,
      slideTitle: getSlideTitle(currentSlideIndex),
    },
    slideRefDismissed: false, // reset on navigation
  });
});
