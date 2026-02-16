import { describe, it, expect } from "vitest";
import { computeOnClickSteps } from "./animationSteps";
import type { Animation } from "@/types/deck";

function anim(overrides: Partial<Animation> = {}): Animation {
  return {
    target: "el1",
    trigger: "onClick",
    effect: "fadeIn",
    ...overrides,
  };
}

describe("computeOnClickSteps", () => {
  it("returns empty array when no animations", () => {
    expect(computeOnClickSteps([])).toEqual([]);
  });

  it("ignores onEnter animations", () => {
    const anims: Animation[] = [
      anim({ trigger: "onEnter" }),
      anim({ trigger: "onEnter", effect: "scaleIn" }),
    ];
    expect(computeOnClickSteps(anims)).toEqual([]);
  });

  it("each undefined-order animation becomes its own step", () => {
    const a1 = anim({ target: "a" });
    const a2 = anim({ target: "b" });
    const steps = computeOnClickSteps([a1, a2]);
    expect(steps).toEqual([[a1], [a2]]);
  });

  it("same order groups into one step", () => {
    const a1 = anim({ target: "a", order: 0 });
    const a2 = anim({ target: "b", order: 0 });
    const steps = computeOnClickSteps([a1, a2]);
    expect(steps).toEqual([[a1, a2]]);
  });

  it("different orders create separate steps sorted ascending", () => {
    const a1 = anim({ target: "a", order: 2 });
    const a2 = anim({ target: "b", order: 0 });
    const a3 = anim({ target: "c", order: 1 });
    const steps = computeOnClickSteps([a1, a2, a3]);
    expect(steps).toEqual([[a2], [a3], [a1]]);
  });

  it("numbered steps come before undefined-order steps", () => {
    const a1 = anim({ target: "a", order: 0 });
    const a2 = anim({ target: "b" }); // undefined order
    const a3 = anim({ target: "c", order: 1 });
    const steps = computeOnClickSteps([a1, a2, a3]);
    expect(steps).toEqual([[a1], [a3], [a2]]);
  });

  it("mixed onEnter and onClick — only onClick are grouped", () => {
    const enter = anim({ trigger: "onEnter", target: "x" });
    const click1 = anim({ target: "a", order: 0 });
    const click2 = anim({ target: "b", order: 0 });
    const click3 = anim({ target: "c" });
    const steps = computeOnClickSteps([enter, click1, click2, click3]);
    expect(steps).toEqual([[click1, click2], [click3]]);
  });

  it("preserves array order within same numbered group", () => {
    const a1 = anim({ target: "a", order: 0, effect: "fadeIn" });
    const a2 = anim({ target: "b", order: 0, effect: "scaleIn" });
    const a3 = anim({ target: "c", order: 0, effect: "slideInLeft" });
    const steps = computeOnClickSteps([a1, a2, a3]);
    expect(steps[0]).toEqual([a1, a2, a3]);
  });
});
