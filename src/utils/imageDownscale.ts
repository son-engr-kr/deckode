/**
 * Browser-side image downscaling for Gemini multimodal calls.
 *
 * Gemini bills images by tile (~258 tokens per 768x768 tile), so token cost is
 * roughly linear in pixel area. Resizing a 4000x3000 photo to 1280x720 cuts
 * cost 5-10x with negligible accuracy loss for slide-context understanding.
 *
 * Output is base64 (no data URL prefix), ready for inlineData.data.
 *
 * Two-tier cache:
 *   1. In-memory Map for the current page session (instant lookups).
 *   2. IndexedDB for cross-session persistence (survives reload).
 * Cache misses fall through to a fresh canvas downscale.
 */

export interface DownscaleOptions {
  maxLongEdge?: number;
  format?: "webp" | "jpeg";
  quality?: number;
}

export interface DownscaledImage {
  base64: string;
  mimeType: "image/webp" | "image/jpeg";
  width: number;
  height: number;
  bytes: number;
}

const DEFAULT_LONG_EDGE = 1280;
const DEFAULT_QUALITY = 0.85;

const memoryCache = new Map<string, Promise<DownscaledImage>>();

// Cache is regenerable, so no legacy-DB migration. The old
// "deckode-image-cache" database is left orphaned on existing users'
// browsers until they explicitly clear site data; it costs negligible disk.
const DB_NAME = "tekkal-image-cache";
const DB_VERSION = 1;
const STORE_NAME = "downscaled";

function cacheKey(src: string, opts: Required<DownscaleOptions>): string {
  return `${src}|${opts.maxLongEdge}|${opts.format}|${opts.quality}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<DownscaledImage | null> {
  try {
    const db = await openDb();
    return await new Promise<DownscaledImage | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as DownscaledImage | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbPut(key: string, value: DownscaledImage): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Persistence failure is non-fatal — memory cache still works.
  }
}

/**
 * Downscale an image to a target long-edge size and encode as base64.
 * Results are cached in memory and persisted to IndexedDB so subsequent
 * calls (even after reload) skip the canvas work entirely.
 */
export function downscaleImage(
  src: string,
  options: DownscaleOptions = {},
): Promise<DownscaledImage> {
  const opts: Required<DownscaleOptions> = {
    maxLongEdge: options.maxLongEdge ?? DEFAULT_LONG_EDGE,
    format: options.format ?? "webp",
    quality: options.quality ?? DEFAULT_QUALITY,
  };
  const key = cacheKey(src, opts);
  const cached = memoryCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const persisted = await idbGet(key);
    if (persisted) return persisted;
    const fresh = await runDownscale(src, opts);
    void idbPut(key, fresh);
    return fresh;
  })();
  memoryCache.set(key, promise);
  promise.catch(() => memoryCache.delete(key));
  return promise;
}

async function runDownscale(
  src: string,
  opts: Required<DownscaleOptions>,
): Promise<DownscaledImage> {
  const img = await loadImage(src);
  const { width, height } = computeTargetSize(img.width, img.height, opts.maxLongEdge);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, width, height);

  const mimeType = opts.format === "webp" ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      mimeType,
      opts.quality,
    );
  });

  const base64 = await blobToBase64(blob);
  return { base64, mimeType, width, height, bytes: blob.size };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function computeTargetSize(
  srcW: number,
  srcH: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(srcW, srcH);
  if (longEdge <= maxLongEdge) return { width: srcW, height: srcH };
  const scale = maxLongEdge / longEdge;
  return { width: Math.round(srcW * scale), height: Math.round(srcH * scale) };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

/** Clear the in-memory cache. Useful in tests or when memory pressure matters. */
export function clearDownscaleCache(): void {
  memoryCache.clear();
}

/** Clear both memory and IndexedDB caches. Useful for explicit "reset" actions. */
export async function clearDownscaleCacheAll(): Promise<void> {
  memoryCache.clear();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Best-effort
  }
}
