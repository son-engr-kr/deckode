/**
 * Sanity test for docs/example-deck.json — the "copy this shape"
 * reference deck shipped to every scaffolded project (see
 * src/adapters/fsAccess.ts) and to every CLI benchmark folder.
 *
 * The example is the canonical answer LLMs imitate when writing
 * deck.json from scratch. If anyone tightens validation.ts without
 * updating the example, the agentic tools downstream will start
 * copying a shape that no longer validates — silently poisoning the
 * benchmark. This test fires immediately on any such drift.
 *
 * The assertion runs the example through the canonical validateDeck
 * from src/ai/validation.ts (NOT the standalone .mjs validator,
 * which gets its own drift tests in tekkal-validate.test.ts).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDeck } from "./validation";
import type { Deck } from "@/types/deck";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const EXAMPLE_DECK_PATH = resolve(__dirname, "..", "..", "docs", "example-deck.json");

describe("docs/example-deck.json", () => {
  it("validates clean against the canonical validateDeck (zero issues of any severity)", () => {
    const raw = readFileSync(EXAMPLE_DECK_PATH, "utf8");
    const deck = JSON.parse(raw) as Deck;
    const result = validateDeck(deck);
    const errors = result.issues.filter((i) => i.severity === "error");
    const warnings = result.issues.filter((i) => i.severity === "warning");
    // Surface the actual messages on failure so a contributor who
    // tightens the schema gets a precise pointer at what to update.
    expect(
      errors,
      `example deck reported errors:\n${errors.map((e) => `  - [${e.slideId ?? ""}/${e.elementId ?? ""}] ${e.message}`).join("\n")}`,
    ).toHaveLength(0);
    expect(
      warnings,
      `example deck reported warnings:\n${warnings.map((w) => `  - [${w.slideId ?? ""}/${w.elementId ?? ""}] ${w.message}`).join("\n")}`,
    ).toHaveLength(0);
  });
});
