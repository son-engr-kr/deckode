/**
 * Auto-caption hook for image elements.
 *
 * When a user adds an image to the deck, this fires a one-shot Gemini
 * multimodal call to generate a one-sentence description and writes it to
 * the element's aiSummary field. Downstream agents (Planner, Generator)
 * then see meaningful image semantics in the deck summary instead of
 * "image[no alt — UNDESCRIBED]".
 *
 * The call is fire-and-forget — failures (no API key, network issues,
 * unsupported format) are logged and silently dropped. We never block the
 * editor on caption generation.
 */

import { useDeckStore } from "@/stores/deckStore";
import { downscaleImage } from "@/utils/imageDownscale";
import { callGemini, getApiKey, getModelForAgent, getAutoCaptionOnUpload } from "./geminiClient";
import type { ImageElement } from "@/types/deck";

const captionsInFlight = new Set<string>();
const captionsDone = new Set<string>();
const captionsFailed = new Set<string>(); // Permanently failed srcs — don't retry

const CAPTION_PROMPT = `Describe this image in one concise sentence (under 25 words) suitable as a slide-context summary for a presentation editor. Focus on what the image depicts, not its style. No leading phrases like "This image shows" — just the description.`;

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000];

/**
 * Schedule a caption generation triggered by an image upload. Honors the
 * `autoCaptionOnUpload` user setting, which defaults to off — users pay
 * Gemini tokens so we do not fire the call unless they explicitly opt in.
 *
 * For "always caption this image regardless of setting" (e.g., lazy on
 * read_slide, or explicit generate_image_caption tool), use
 * `scheduleImageCaptionForced` instead.
 */
export function scheduleImageCaption(slideId: string, elementId: string): void {
  if (!getAutoCaptionOnUpload()) return;
  queueMicrotask(() => runCaption(slideId, elementId));
}

/**
 * Force a caption generation regardless of the upload-time setting. Use this
 * for on-demand paths: when AI reads an image, when the user explicitly
 * asks for a caption, or when an attached image needs a cached summary.
 */
export function scheduleImageCaptionForced(slideId: string, elementId: string): void {
  queueMicrotask(() => runCaption(slideId, elementId));
}

/**
 * Synchronous-return variant for explicit tool calls that need to wait for
 * the caption before returning. Returns the generated summary, the cached
 * one if already captioned, or null on failure / missing API key.
 */
export async function captionImageNow(slideId: string, elementId: string): Promise<string | null> {
  if (!getApiKey()) return null;

  const deck = useDeckStore.getState().deck;
  if (!deck) return null;
  const slide = deck.slides.find((s) => s.id === slideId);
  const element = slide?.elements.find((e) => e.id === elementId);
  if (!element || element.type !== "image") return null;

  const img = element as ImageElement;
  if (img.aiSummary) return img.aiSummary;
  if (!img.src) return null;
  if (captionsFailed.has(img.src)) return null;

  // Wait for any in-flight generation for the same src
  if (captionsInFlight.has(img.src)) {
    while (captionsInFlight.has(img.src)) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const refreshed = useDeckStore.getState().deck?.slides
      .find((s) => s.id === slideId)?.elements
      .find((e) => e.id === elementId);
    if (refreshed && refreshed.type === "image") {
      return (refreshed as ImageElement).aiSummary ?? null;
    }
    return null;
  }

  captionsInFlight.add(img.src);
  try {
    const summary = await captionWithRetry(img.src);
    if (!summary) {
      captionsFailed.add(img.src);
      return null;
    }
    useDeckStore.getState().updateElement(slideId, elementId, { aiSummary: summary });
    captionsDone.add(img.src);
    return summary;
  } catch (err) {
    console.warn(`[imageCaption] captionImageNow failed for ${elementId}:`, err);
    captionsFailed.add(img.src);
    return null;
  } finally {
    captionsInFlight.delete(img.src);
  }
}

async function runCaption(slideId: string, elementId: string): Promise<void> {
  if (!getApiKey()) return; // No API key configured — silent skip

  const deck = useDeckStore.getState().deck;
  if (!deck) return;
  const slide = deck.slides.find((s) => s.id === slideId);
  const element = slide?.elements.find((e) => e.id === elementId);
  if (!element || element.type !== "image") return;

  const img = element as ImageElement;
  if (!img.src) return;
  if (img.aiSummary) return; // Already captioned
  if (captionsDone.has(img.src)) return;
  if (captionsFailed.has(img.src)) return;
  if (captionsInFlight.has(img.src)) return;

  captionsInFlight.add(img.src);
  try {
    const summary = await captionWithRetry(img.src);
    if (!summary) {
      captionsFailed.add(img.src);
      return;
    }

    // Re-check the element still exists; it may have been deleted while we waited
    const currentDeck = useDeckStore.getState().deck;
    const currentSlide = currentDeck?.slides.find((s) => s.id === slideId);
    const currentEl = currentSlide?.elements.find((e) => e.id === elementId);
    if (!currentEl || currentEl.type !== "image") return;

    useDeckStore.getState().updateElement(slideId, elementId, { aiSummary: summary });
    captionsDone.add(img.src);
  } catch (err) {
    console.warn(`[imageCaption] permanently failed for ${elementId}:`, err);
    captionsFailed.add(img.src);
  } finally {
    captionsInFlight.delete(img.src);
  }
}

/**
 * Run the caption call with bounded exponential backoff. Downscaling happens
 * once (it's cached), but the network call can be retried on transient
 * failures like 429 rate limits or transient 5xx. A permanent failure
 * (invalid source image, malformed API key) surfaces immediately.
 */
async function captionWithRetry(src: string): Promise<string | null> {
  let downscaled: Awaited<ReturnType<typeof downscaleImage>>;
  try {
    downscaled = await downscaleImage(src, { maxLongEdge: 768 });
  } catch (err) {
    // Downscaling failure is permanent (bad src, CORS block) — don't retry
    throw err;
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await callGemini({
        model: getModelForAgent("planner"),
        systemInstruction: "You write concise, factual image descriptions for a slide editor. One sentence only.",
        message: [
          { text: CAPTION_PROMPT },
          {
            inlineData: {
              mimeType: downscaled.mimeType,
              data: downscaled.base64,
            },
          },
        ],
      });
      const summary = response.text.trim().replace(/^["']|["']$/g, "");
      return summary || null;
    } catch (err) {
      lastError = err;
      if (!isTransientError(err) || attempt === MAX_ATTEMPTS - 1) break;
      const delay = BACKOFF_MS[attempt] ?? 4000;
      console.debug(`[imageCaption] retry ${attempt + 1}/${MAX_ATTEMPTS} after ${delay}ms:`, err);
      await sleep(delay);
    }
  }
  throw lastError;
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Gemini SDK surfaces HTTP errors with status codes in the message.
  // 429 (rate limit), 500/502/503/504 (server errors), and network
  // failures are all worth retrying. 400/401/403 are permanent.
  return /\b(429|500|502|503|504)\b|network|fetch|timeout|ECONNRESET|ETIMEDOUT/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Test/dev helper: clear caption caches. */
export function clearCaptionCache(): void {
  captionsInFlight.clear();
  captionsDone.clear();
  captionsFailed.clear();
}
