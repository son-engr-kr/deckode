/**
 * Regression tests for deckStore's invariant assertions. These used
 * to fail silently because the check was written against the wrong
 * type discriminator, so addElement / updateElement accepted input
 * the renderer would later assert-fail on.
 */
// @ts-nocheck — intentional invalid shape element for the test
import { describe, it, expect, beforeEach } from "vitest";
import { useDeckStore } from "./deckStore";
import type { Deck } from "@/types/deck";

function deck(): Deck {
  return {
    version: "0.1.0",
    meta: { title: "Test", aspectRatio: "16:9" },
    slides: [{ id: "s1", elements: [] }],
  };
}

beforeEach(() => {
  useDeckStore.getState().closeProject();
});

describe("assertNoLineRotation — guards against arrow/line with rotation", () => {
  it("rejects add_element for a line shape that carries a rotation field", () => {
    useDeckStore.getState().openProject("test", deck());
    expect(() => {
      useDeckStore.getState().addElement("s1", {
        id: "bad",
        type: "shape",
        shape: "line",
        rotation: 45,
        position: { x: 0, y: 0 },
        size: { w: 100, h: 100 },
      });
    }).toThrow(/waypoints.*not rotation/);
  });

  it("rejects add_element for an arrow shape with a rotation field", () => {
    useDeckStore.getState().openProject("test", deck());
    expect(() => {
      useDeckStore.getState().addElement("s1", {
        id: "bad",
        type: "shape",
        shape: "arrow",
        rotation: 90,
        position: { x: 0, y: 0 },
        size: { w: 100, h: 100 },
      });
    }).toThrow(/waypoints.*not rotation/);
  });

  it("allows rectangle shapes to have rotation", () => {
    useDeckStore.getState().openProject("test", deck());
    expect(() => {
      useDeckStore.getState().addElement("s1", {
        id: "ok",
        type: "shape",
        shape: "rectangle",
        rotation: 45,
        position: { x: 0, y: 0 },
        size: { w: 100, h: 100 },
      });
    }).not.toThrow();
  });

  it("allows text elements to have rotation", () => {
    useDeckStore.getState().openProject("test", deck());
    expect(() => {
      useDeckStore.getState().addElement("s1", {
        id: "ok",
        type: "text",
        content: "hi",
        rotation: 15,
        position: { x: 0, y: 0 },
        size: { w: 100, h: 50 },
      });
    }).not.toThrow();
  });

  it("rejects add_element when the element ID already exists on the same slide", () => {
    useDeckStore.getState().openProject("test", deck());
    useDeckStore.getState().addElement("s1", {
      id: "dup",
      type: "text",
      content: "first",
      position: { x: 0, y: 0 },
      size: { w: 100, h: 50 },
    });
    expect(() => {
      useDeckStore.getState().addElement("s1", {
        id: "dup",
        type: "text",
        content: "second",
        position: { x: 0, y: 0 },
        size: { w: 100, h: 50 },
      });
    }).toThrow(/already exists|duplicate/i);
  });

  it("rejects add_element when the element ID exists on any other slide", () => {
    // Element IDs are deck-global per syncCounters / cloneSlide
    // assumptions. A duplicate across slides would be silently
    // renamed by the next save, and any in-session animations or
    // comments referencing it would resolve to the wrong element.
    const d = deck();
    d.slides.push({ id: "s2", elements: [] });
    useDeckStore.getState().openProject("test", d);
    useDeckStore.getState().addElement("s1", {
      id: "shared",
      type: "text",
      content: "on s1",
      position: { x: 0, y: 0 },
      size: { w: 100, h: 50 },
    });
    expect(() => {
      useDeckStore.getState().addElement("s2", {
        id: "shared",
        type: "text",
        content: "on s2",
        position: { x: 0, y: 0 },
        size: { w: 100, h: 50 },
      });
    }).toThrow(/already exists|duplicate/i);
  });

  it("rejects addSlide when the slide id already exists", () => {
    useDeckStore.getState().openProject("test", deck());
    expect(() => {
      useDeckStore.getState().addSlide({ id: "s1", elements: [] });
    }).toThrow(/already exists|duplicate/i);
  });

  it("rejects addSlide when the new slide reuses an existing element id", () => {
    useDeckStore.getState().openProject("test", deck());
    useDeckStore.getState().addElement("s1", {
      id: "shared",
      type: "text",
      content: "on s1",
      position: { x: 0, y: 0 },
      size: { w: 100, h: 50 },
    });
    expect(() => {
      useDeckStore.getState().addSlide({
        id: "s2",
        elements: [{
          id: "shared",
          type: "text",
          content: "on s2",
          position: { x: 0, y: 0 },
          size: { w: 100, h: 50 },
        }],
      });
    }).toThrow(/already exists/i);
  });

  it("rejects addAnimation targeting an element that does not exist", () => {
    useDeckStore.getState().openProject("test", deck());
    expect(() => {
      useDeckStore.getState().addAnimation("s1", {
        target: "ghost",
        effect: "fadeIn",
        trigger: "onEnter",
      });
    }).toThrow(/not found/i);
  });

  it("rejects updateAnimation that retargets to an element that does not exist", () => {
    const d = deck();
    d.slides[0]!.elements.push({
      id: "e1",
      type: "text",
      content: "hi",
      position: { x: 0, y: 0 },
      size: { w: 100, h: 50 },
    });
    d.slides[0]!.animations = [{ target: "e1", effect: "fadeIn", trigger: "onEnter" }];
    useDeckStore.getState().openProject("test", d);
    expect(() => {
      useDeckStore.getState().updateAnimation("s1", 0, { target: "ghost" });
    }).toThrow(/not found/i);
  });

  it("rejects addComment anchored to an element that does not exist", () => {
    useDeckStore.getState().openProject("test", deck());
    expect(() => {
      useDeckStore.getState().addComment("s1", {
        id: "c1",
        text: "hi",
        elementId: "ghost",
        createdAt: 1,
      });
    }).toThrow(/not found/i);
  });

  it("re-anchors animations and comments when detachReference inlines a component", () => {
    // Set up: a component with one element, a slide that references
    // it, and an animation + comment pinned to the reference's id.
    const d = deck();
    d.components = {
      compA: {
        id: "compA",
        name: "C",
        elements: [{
          id: "compA-e0",
          type: "text",
          content: "inside",
          position: { x: 0, y: 0 },
          size: { w: 50, h: 20 },
        }],
      },
    };
    d.slides[0]!.elements.push({
      id: "ref1",
      type: "reference",
      componentId: "compA",
      position: { x: 0, y: 0 },
      size: { w: 50, h: 20 },
    });
    useDeckStore.getState().openProject("test", d);
    // Have to bypass the new addAnimation guard by inserting
    // directly into the deck via openProject above. Now the animation
    // pre-exists pointing at "ref1".
    useDeckStore.setState((s) => {
      s.deck!.slides[0]!.animations = [{ target: "ref1", effect: "fadeIn", trigger: "onEnter" }];
      s.deck!.slides[0]!.comments = [{ id: "c1", elementId: "ref1", text: "fix", createdAt: 1 }];
    });

    useDeckStore.getState().detachReference("s1", "ref1");

    const slide = useDeckStore.getState().deck!.slides[0]!;
    const inlinedId = slide.elements[0]!.id;
    expect(slide.animations![0]!.target).toBe(inlinedId);
    expect(slide.comments![0]!.elementId).toBe(inlinedId);
  });

  it("rejects update_element that adds rotation to an existing line shape", () => {
    useDeckStore.getState().openProject("test", deck());
    useDeckStore.getState().addElement("s1", {
      id: "line1",
      type: "shape",
      shape: "line",
      position: { x: 0, y: 0 },
      size: { w: 100, h: 100 },
    });
    expect(() => {
      useDeckStore.getState().updateElement("s1", "line1", { rotation: 30 });
    }).toThrow(/waypoints.*not rotation/);
  });
});
