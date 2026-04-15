/**
 * In-app validation wrapper. The actual schema checks live in
 * `src/schema/validate.ts` so the CLI validator, unit tests, and the
 * live editor all agree on what "valid" means. This file keeps only:
 *
 *   - Re-exports of validateDeck + related types from the shared core
 *   - buildFixInstructions: formats issues into fix hints for the AI loop
 *   - resolveOverlaps: mutating helper that nudges elements apart
 *
 * When you want to add or change a validator check, edit
 * `src/schema/validate.ts` (and mirror the change in
 * `scripts/tekkal-validate.mjs`, which is constrained to stay
 * self-contained so it can be copied into user projects).
 */

import type { Slide } from "@/types/deck";
import {
  validateDeck,
  effectiveSize,
  type ValidationIssue,
  type ValidationResult,
} from "@/schema/validate";

export { validateDeck };
export type { ValidationIssue, ValidationResult };

export function buildFixInstructions(result: ValidationResult): string {
  if (result.issues.length === 0) return "";

  const lines: string[] = [];

  for (const i of result.issues) {
    const loc = i.elementId ? `[${i.slideId}/${i.elementId}]` : `[${i.slideId}]`;
    if (i.autoFixable) {
      if (i.message.includes("overflows right")) {
        lines.push(`- FIX ${loc} Reduce width or move left to fit within 960px`);
      } else if (i.message.includes("overflows bottom")) {
        lines.push(`- FIX ${loc} Reduce height or move up to fit within 540px`);
      } else if (i.message.includes("negative")) {
        lines.push(`- FIX ${loc} Move position to positive coordinates`);
      } else if (i.message.includes("Font size too small")) {
        lines.push(`- FIX ${loc} Increase font size to at least 12`);
      } else if (i.message.includes("Font size too large")) {
        lines.push(`- FIX ${loc} Decrease font size to at most 60`);
      } else if (i.message.includes("zero or missing size")) {
        lines.push(`- FIX ${loc} Set reasonable width and height`);
      } else {
        lines.push(`- FIX ${loc} ${i.message}`);
      }
    } else if (i.severity === "error") {
      lines.push(`- CRITICAL ${loc} ${i.message}`);
    } else if (i.severity === "warning" && i.message.includes("overlap")) {
      lines.push(`- FIX ${loc} ${i.message} — call update_element with the suggested position`);
    } else if (i.severity === "warning" && i.message.includes("lines")) {
      lines.push(`- FIX ${loc} ${i.message} — trim code to at most 25 lines showing only the essential concept`);
    } else if (i.severity === "warning" && i.message.includes("\\\\")) {
      lines.push(`- FIX ${loc} ${i.message} — replace \\\\\\\\cmd with \\\\cmd (single backslash), use \\\\mathbf{} for bold`);
    }
  }

  if (lines.length === 0) return "";
  return `Issues found:\n${lines.join("\n")}`;
}

/**
 * Programmatically resolve element overlaps by nudging the smaller element
 * to the nearest valid non-overlapping position.
 * Applies the same exemption logic as validateDeck (line/arrow excluded,
 * allowOverlap, groupId, shape-on-content, annotation, label-on-box,
 * container pattern, image overlay).
 * Returns the number of elements moved.
 */
export function resolveOverlaps(
  _slideId: string,
  slide: Slide,
  updateFn: (elementId: string, patch: { position: { x: number; y: number } }) => void,
): number {
  const CANVAS_W = 960;
  const CANVAS_H = 540;
  const GAP = 10;

  // Mutable position tracking (separate from store so cascade moves work)
  const pos = new Map<string, { x: number; y: number }>(
    slide.elements
      .filter((e) => e.position)
      .map((e) => [e.id, { x: e.position.x, y: e.position.y }]),
  );
  const siz = new Map<string, { w: number; h: number }>();
  for (const e of slide.elements) {
    const eff = effectiveSize(e.size);
    if (eff.w !== undefined && eff.h !== undefined) {
      siz.set(e.id, { w: eff.w, h: eff.h });
    }
  }

  // Mirror validateDeck's line/arrow exclusion: their bbox isn't a visual region.
  const isLineLike = (e: typeof slide.elements[number]): boolean =>
    e.type === "shape" &&
    ((e as { shape?: string }).shape === "line" ||
      (e as { shape?: string }).shape === "arrow");

  const measurable = slide.elements.filter((e) => {
    if (!e.position) return false;
    if (isLineLike(e)) return false;
    const s = siz.get(e.id);
    return s !== undefined && s.w > 5 && s.h > 5;
  });

  const VISUAL = ["shape"];
  const CONTENT = ["text", "table", "code"];

  let totalFixed = 0;

  for (let iter = 0; iter < 5; iter++) {
    let fixedThisRound = 0;

    for (let a = 0; a < measurable.length; a++) {
      for (let b = a + 1; b < measurable.length; b++) {
        const ea = measurable[a]!;
        const eb = measurable[b]!;

        // Opt-out via allowOverlap
        if ((ea as { allowOverlap?: boolean }).allowOverlap) continue;
        if ((eb as { allowOverlap?: boolean }).allowOverlap) continue;

        // Same exemptions as validateDeck
        const gaGroup = (ea as { groupId?: string }).groupId;
        const gbGroup = (eb as { groupId?: string }).groupId;
        if (gaGroup && gaGroup === gbGroup) continue;

        const eaType = (ea as { type?: string }).type;
        const ebType = (eb as { type?: string }).type;
        if (
          (VISUAL.includes(eaType ?? "") && CONTENT.includes(ebType ?? "")) ||
          (CONTENT.includes(eaType ?? "") && VISUAL.includes(ebType ?? ""))
        ) continue;

        const pA = pos.get(ea.id);
        const pB = pos.get(eb.id);
        const sA = siz.get(ea.id);
        const sB = siz.get(eb.id);
        if (!pA || !pB || !sA || !sB) continue;

        const ow = Math.min(pA.x + sA.w, pB.x + sB.w) - Math.max(pA.x, pB.x);
        const oh = Math.min(pA.y + sA.h, pB.y + sB.h) - Math.max(pA.y, pB.y);
        if (ow <= 20 || oh <= 20) continue;

        const areaA = sA.w * sA.h;
        const areaB = sB.w * sB.h;
        const pct = (ow * oh) / Math.min(areaA, areaB);

        const isLabelOnBox = pct > 0.9 && Math.max(areaA, areaB) / Math.min(areaA, areaB) > 3;
        const isAnnotation = Math.max(areaA, areaB) / Math.min(areaA, areaB) > 4;
        // Container pattern: rectangle shape fully enclosing another element
        const eaIsRect = eaType === "shape" && (ea as { shape?: string }).shape === "rectangle";
        const ebIsRect = ebType === "shape" && (eb as { shape?: string }).shape === "rectangle";
        const aEncB = eaIsRect && pA.x <= pB.x && pA.y <= pB.y &&
          pA.x + sA.w >= pB.x + sB.w && pA.y + sA.h >= pB.y + sB.h;
        const bEncA = ebIsRect && pB.x <= pA.x && pB.y <= pA.y &&
          pB.x + sB.w >= pA.x + sA.w && pB.y + sB.h >= pA.y + sA.h;
        if (isLabelOnBox || isAnnotation || aEncB || bEncA) continue;
        // Image overlays are user-intent, skip auto-resolve
        if (eaType === "image" || ebType === "image") continue;
        if (pct <= 0.15) continue;

        // Move the smaller element
        const moveB = areaA >= areaB;
        const largerP = moveB ? pA : pB;
        const largerS = moveB ? sA : sB;
        const smallerId = moveB ? eb.id : ea.id;
        const smallerP = moveB ? pB : pA;
        const smallerS = moveB ? sB : sA;

        const candidates = [
          { x: largerP.x + largerS.w + GAP, y: smallerP.y },   // right
          { x: smallerP.x, y: largerP.y + largerS.h + GAP },   // below
          { x: largerP.x - smallerS.w - GAP, y: smallerP.y },  // left
          { x: smallerP.x, y: largerP.y - smallerS.h - GAP },  // above
        ];

        const valid = candidates.filter(
          (p) =>
            p.x >= 0 &&
            p.y >= 0 &&
            p.x + smallerS.w <= CANVAS_W &&
            p.y + smallerS.h <= CANVAS_H,
        );
        if (valid.length === 0) continue;

        const best = valid.reduce((a, c) =>
          Math.hypot(a.x - smallerP.x, a.y - smallerP.y) <
          Math.hypot(c.x - smallerP.x, c.y - smallerP.y)
            ? a : c,
        );

        pos.set(smallerId, best);
        updateFn(smallerId, { position: best });
        fixedThisRound++;
      }
    }

    totalFixed += fixedThisRound;
    if (fixedThisRound === 0) break;
  }

  return totalFixed;
}
