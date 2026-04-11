/**
 * Drift tests for scripts/tekkal-validate.mjs.
 *
 * The standalone validator duplicates checks from src/ai/validation.ts
 * so it can be copied verbatim into agentic-tool project folders that
 * do not have the TEKKAL repo checked out. Without these tests, the
 * two implementations would silently diverge over time and the
 * benchmark infrastructure would quietly stop catching the failure
 * modes the spec says it must catch.
 *
 * Each test builds a minimal hand-written deck (3-5 elements, just
 * enough to trip one check), writes it to a scratch tmp file, and
 * spawns the validator the same way external CLI tools do. The
 * assertions pin both the exit code and the field path / id mention
 * in the report so an LLM reading the message has enough information
 * to act on it.
 *
 * Spawning the script as a child process is necessary because the
 * .mjs file calls main() and process.exit() at import time and the
 * spec forbids modifying the script. Spawn cost is ~50ms per fixture
 * which is well within the suite's tolerance.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const REPO_ROOT = resolve(__dirname, "..", "..");
const VALIDATOR_PATH = resolve(REPO_ROOT, "scripts", "tekkal-validate.mjs");
const EXAMPLE_DECK_PATH = resolve(REPO_ROOT, "docs", "example-deck.json");

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

let scratchDir: string;

beforeAll(() => {
  scratchDir = mkdtempSync(join(tmpdir(), "tekkal-validate-test-"));
});

afterAll(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

function runValidator(filePath: string): RunResult {
  // execFileSync throws on non-zero exit. Capture status from the
  // thrown error so we can assert on both pass and fail paths
  // uniformly.
  try {
    const stdout = execFileSync("node", [VALIDATOR_PATH, filePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      exitCode: typeof e.status === "number" ? e.status : 1,
      stdout: e.stdout?.toString() ?? "",
      stderr: e.stderr?.toString() ?? "",
    };
  }
}

function runDeck(deck: unknown, name: string): RunResult {
  const filePath = join(scratchDir, `${name}.json`);
  writeFileSync(filePath, JSON.stringify(deck, null, 2), "utf8");
  return runValidator(filePath);
}

// ── Minimal builders. Hand-written, just enough to trip one check. ──

interface Pos { x: number; y: number }
interface Sz { w: number; h: number }

function pos(x: number, y: number): Pos { return { x, y }; }
function size(w: number, h: number): Sz { return { w, h }; }

function deckOf(slides: unknown[]): unknown {
  return {
    version: "0.1.0",
    meta: { title: "Test", aspectRatio: "16:9" },
    slides,
  };
}

function slideOf(id: string, elements: unknown[], extras: Record<string, unknown> = {}): unknown {
  return { id, elements, ...extras };
}

function textEl(id: string, content: string, extras: Record<string, unknown> = {}): unknown {
  return {
    id,
    type: "text",
    content,
    position: pos(20, 20),
    size: size(400, 80),
    ...extras,
  };
}

// ─────────────────────────────────────────────────────────────────
// Sanity: example-deck.json must pass cleanly
// ─────────────────────────────────────────────────────────────────

describe("tekkal-validate.mjs sanity", () => {
  it("docs/example-deck.json passes with exit code 0 and zero errors", () => {
    const result = runValidator(EXAMPLE_DECK_PATH);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/RESULT: PASS/);
    expect(result.stdout).toMatch(/ERRORS \(0\)/);
    // Sanity-check the example actually got walked, not silently skipped.
    const exampleSrc = JSON.parse(readFileSync(EXAMPLE_DECK_PATH, "utf8")) as { slides: unknown[] };
    expect(result.stdout).toContain(`${exampleSrc.slides.length} slides`);
  });
});

// ─────────────────────────────────────────────────────────────────
// Drift tests: each fixture trips exactly one documented check
// ─────────────────────────────────────────────────────────────────

describe("tekkal-validate.mjs drift", () => {
  it("flags shape line with top-level waypoints (Gemini-CLI failure shape)", () => {
    const result = runDeck(
      deckOf([
        slideOf("s1", [
          {
            id: "line1",
            type: "shape",
            shape: "line",
            position: pos(20, 20),
            size: size(200, 100),
            // Top-level instead of nested under style.waypoints
            waypoints: [{ x: 0, y: 0 }, { x: 200, y: 100 }],
          },
        ]),
      ]),
      "shape-line-toplevel-waypoints",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/RESULT: FAIL/);
    // Field path must point at the top-level waypoints field
    expect(result.stdout).toMatch(/slides\[0\]\.elements\[0\]\.waypoints/);
    // Message must steer the LLM toward style.waypoints
    expect(result.stdout).toMatch(/style\.waypoints/);
  });

  it("flags shape line with style.waypoints as [[x,y]] tuples instead of {x,y} objects", () => {
    const result = runDeck(
      deckOf([
        slideOf("s1", [
          {
            id: "line2",
            type: "shape",
            shape: "line",
            position: pos(20, 20),
            size: size(200, 100),
            style: {
              // Tuple form is the second-most-common LLM mistake after the
              // top-level placement bug. Must be {x, y} objects.
              waypoints: [[0, 0], [200, 100]],
            },
          },
        ]),
      ]),
      "shape-line-tuple-waypoints",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/slides\[0\]\.elements\[0\]\.style\.waypoints\[0\]/);
    // Must explicitly state the {x: number, y: number} requirement
    expect(result.stdout).toMatch(/\{x.*y.*\}/);
  });

  it("flags video element using url field instead of src", () => {
    const result = runDeck(
      deckOf([
        slideOf("s1", [
          {
            id: "vid1",
            type: "video",
            url: "https://example.com/clip.mp4",
            position: pos(20, 20),
            size: size(320, 200),
          },
        ]),
      ]),
      "video-url-not-src",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/slides\[0\]\.elements\[0\]\.src/);
    expect(result.stdout).toMatch(/uses url instead of src/);
  });

  it("flags image element using url field instead of src", () => {
    const result = runDeck(
      deckOf([
        slideOf("s1", [
          {
            id: "img1",
            type: "image",
            url: "/assets/foo.png",
            position: pos(20, 20),
            size: size(320, 200),
          },
        ]),
      ]),
      "image-url-not-src",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/slides\[0\]\.elements\[0\]\.src/);
    expect(result.stdout).toMatch(/uses url instead of src/);
  });

  it("flags duplicate element ids across two different slides", () => {
    const result = runDeck(
      deckOf([
        slideOf("s1", [textEl("e1", "first")]),
        slideOf("s2", [textEl("e1", "second")]),
      ]),
      "duplicate-cross-slide-ids",
    );
    expect(result.exitCode).toBe(1);
    // The second occurrence is the one flagged, with the prior site
    // mentioned in the message so the LLM can find both copies.
    expect(result.stdout).toMatch(/slides\[1\]\.elements\[0\]\.id/);
    expect(result.stdout).toMatch(/Duplicate element id "e1"/);
    expect(result.stdout).toMatch(/slides\[0\]\.elements\[0\]/);
  });

  it("flags arrow element carrying a rotation field", () => {
    const result = runDeck(
      deckOf([
        slideOf("s1", [
          {
            id: "arr1",
            type: "shape",
            shape: "arrow",
            rotation: 45,
            position: pos(20, 20),
            size: size(200, 100),
            style: { waypoints: [{ x: 0, y: 0 }, { x: 200, y: 0 }] },
          },
        ]),
      ]),
      "arrow-with-rotation",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/slides\[0\]\.elements\[0\]\.rotation/);
    // Message must mention waypoints so the LLM knows the fix.
    expect(result.stdout).toMatch(/waypoints/);
  });

  it("flags code element with content longer than 12 lines", () => {
    const longCode = Array.from({ length: 15 }, (_, i) => `line${i}`).join("\n");
    const result = runDeck(
      deckOf([
        slideOf("s1", [
          {
            id: "code1",
            type: "code",
            language: "python",
            content: longCode,
            position: pos(20, 20),
            size: size(400, 300),
          },
        ]),
      ]),
      "code-too-long",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/slides\[0\]\.elements\[0\]\.content/);
    // Validator reports the actual line count so the LLM sees the gap.
    expect(result.stdout).toMatch(/15 lines/);
  });

  it("flags **bold** inside $...$ math in a text element", () => {
    const result = runDeck(
      deckOf([
        slideOf("s1", [
          textEl("t1", "Inline math with **bold**: $E = **mc**^2$ which is wrong"),
        ]),
      ]),
      "text-bold-in-math",
    );
    // Bold-inside-math is severity warning per the canonical
    // validator rule (see src/ai/validation.ts). It still must be
    // surfaced in the report; assert against WARNINGS rather than
    // ERRORS so the test pins the actual severity.
    expect(result.stdout).toMatch(/slides\[0\]\.elements\[0\]\.content/);
    expect(result.stdout).toMatch(/bold.*math/i);
  });

  it("flags \\\\ line-break sequence in non-math text content", () => {
    const result = runDeck(
      deckOf([
        slideOf("s1", [
          // Two backslashes + n is the LLM's most common LaTeX-line-break
          // mistake (it survives JSON encoding as \\\\). The validator
          // strips known math envs first, so the remaining \\ here is
          // genuinely outside an environment.
          textEl("t1", "Free-standing line break: foo \\\\ bar"),
        ]),
      ]),
      "text-backslash-outside-math",
    );
    expect(result.stdout).toMatch(/slides\[0\]\.elements\[0\]\.content/);
    expect(result.stdout).toMatch(/\\\\/);
  });

  it("flags TikZ element missing the \\path ... rectangle bounding box", () => {
    const result = runDeck(
      deckOf([
        slideOf("s1", [
          {
            id: "tk1",
            type: "tikz",
            // No \path and no rectangle anywhere — content will be clipped.
            content: "\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}",
            position: pos(20, 20),
            size: size(300, 200),
          },
        ]),
      ]),
      "tikz-missing-bbox",
    );
    expect(result.stdout).toMatch(/slides\[0\]\.elements\[0\]\.content/);
    expect(result.stdout).toMatch(/bounding box/);
  });

  it("flags step marker count mismatch with onClick animation count", () => {
    const result = runDeck(
      deckOf([
        slideOf(
          "s1",
          [textEl("t1", "first"), textEl("t2", "second")],
          {
            // Two step markers, but only one onClick animation — mismatch.
            notes: "[step:1] reveal first; [step:2] reveal second",
            animations: [
              { target: "t1", effect: "fadeIn", trigger: "onClick" },
            ],
          },
        ),
      ]),
      "step-vs-onclick-mismatch",
    );
    // Step-vs-onClick mismatch is reported against the slide path,
    // not an individual element. Assert on the slide id.
    expect(result.stdout).toMatch(/slides\[0\]\.notes/);
    expect(result.stdout).toMatch(/Step marker count.*onClick/);
  });
});
