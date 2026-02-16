import type { Animation } from "@/types/deck";

/**
 * Groups onClick animations into sequential steps.
 *
 * - Same `order` value → play together in one step.
 * - `order === undefined` → each becomes its own step.
 * - Numbered steps come first (ascending), then undefined-order steps in array order.
 */
export function computeOnClickSteps(animations: Animation[]): Animation[][] {
  const onClicks = animations.filter((a) => a.trigger === "onClick");
  if (onClicks.length === 0) return [];

  const numbered = new Map<number, Animation[]>();
  const unnumbered: Animation[] = [];

  for (const anim of onClicks) {
    if (anim.order !== undefined) {
      const group = numbered.get(anim.order);
      if (group) {
        group.push(anim);
      } else {
        numbered.set(anim.order, [anim]);
      }
    } else {
      unnumbered.push(anim);
    }
  }

  // Sort numbered groups by order value ascending
  const sortedKeys = [...numbered.keys()].sort((a, b) => a - b);
  const steps: Animation[][] = sortedKeys.map((key) => numbered.get(key)!);

  // Each unnumbered animation is its own step
  for (const anim of unnumbered) {
    steps.push([anim]);
  }

  return steps;
}
