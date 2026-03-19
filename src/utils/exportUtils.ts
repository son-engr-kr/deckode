import type { FileSystemAdapter } from "@/adapters/types";

// ---- Defaults (matching React renderers exactly) ----

export const DEFAULT_BG = "#ffffff";
export const DEFAULT_TEXT_COLOR = "#1e293b";
export const DEFAULT_TEXT_SIZE = 24;
export const DEFAULT_TEXT_FONT = "Inter, system-ui, sans-serif";
export const DEFAULT_LINE_HEIGHT = 1.5;
export const DEFAULT_CODE_SIZE = 16;
export const DEFAULT_CODE_BG = "#f8f8f8";
export const DEFAULT_CODE_FG = "#1e293b";
export const DEFAULT_CODE_RADIUS = 8;
export const DEFAULT_CODE_THEME = "github-light";
export const DEFAULT_TABLE_SIZE = 14;

// ---- Style resolution (mirrors ThemeContext.resolveStyle) ----

export function resolveStyle<T extends object>(
  theme: Partial<T> | undefined,
  element: Partial<T> | undefined,
): Partial<T> {
  if (!theme) return element ?? ({} as Partial<T>);
  if (!element) return theme;
  return { ...theme, ...element };
}

// ---- Asset URL resolution (delegates to the active adapter) ----

export async function resolveAssetSrc(
  src: string,
  adapter: FileSystemAdapter,
): Promise<string> {
  const result = adapter.resolveAssetUrl(src);
  const resolved = typeof result === "string" ? result : await result;
  return resolved ?? src;
}

// ----

export function stripMarkdown(md: string): string {
  return md
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/^\s*[-*]\s/gm, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1") // block math
    .replace(/\$(.*?)\$/g, "$1") // inline math
    .trim();
}

export function toHex(color: string | undefined): string | undefined {
  if (!color || color === "transparent") return undefined;
  return color.replace(/^#/, "");
}

export async function fetchImageAsBase64(src: string): Promise<string | null> {
  const urls = [
    src,
    src.startsWith("./") ? src.slice(2) : src,
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      continue;
    }
  }
  return null;
}

/** Check if a source path points to a PDF file. */
export function isPdfSrc(src: string): boolean {
  const path = src.split("?")[0]!;
  return path.toLowerCase().endsWith(".pdf");
}

/**
 * Render the first page of a PDF to a PNG data URI.
 * Used by PDF/PPTX exporters to handle PDF-as-image elements.
 */
export async function rasterizePdfToBase64(
  src: string,
  width: number,
  _height: number,
): Promise<string | null> {
  const { GlobalWorkerOptions, getDocument } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;

  let doc;
  try {
    doc = await getDocument(src).promise;
  } catch {
    return null;
  }

  const page = await doc.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = (width / baseViewport.width) * 2; // 2x for quality
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/png");
  doc.destroy();
  return dataUrl;
}

// ---- Crop: render image with object-fit, extract crop region via canvas ----

import type { CropRect } from "@/types/deck";

export async function cropImageViaCanvas(
  imgData: string,
  elementW: number,
  elementH: number,
  objectFit: string,
  crop: CropRect,
): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = imgData;
  });

  const nw = img.naturalWidth || elementW;
  const nh = img.naturalHeight || elementH;

  // Compute rendered position/size within element box (object-fit)
  let rw: number, rh: number, rx: number, ry: number;
  if (objectFit === "fill") {
    rw = elementW; rh = elementH; rx = 0; ry = 0;
  } else if (objectFit === "cover") {
    if (nw / nh > elementW / elementH) {
      rh = elementH; rw = elementH * (nw / nh);
    } else {
      rw = elementW; rh = elementW * (nh / nw);
    }
    rx = (elementW - rw) / 2;
    ry = (elementH - rh) / 2;
  } else {
    // contain
    if (nw / nh > elementW / elementH) {
      rw = elementW; rh = elementW * (nh / nw);
    } else {
      rh = elementH; rw = elementH * (nw / nh);
    }
    rx = (elementW - rw) / 2;
    ry = (elementH - rh) / 2;
  }

  // Crop region in element-local coordinates
  const cx = elementW * crop.left;
  const cy = elementH * crop.top;
  const cw = elementW * (1 - crop.left - crop.right);
  const ch = elementH * (1 - crop.top - crop.bottom);
  if (cw <= 0 || ch <= 0) return imgData;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cw * scale);
  canvas.height = Math.round(ch * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, rx - cx, ry - cy, rw, rh);
  return canvas.toDataURL("image/png");
}

// ---- Video first frame capture (returns base64 data URL) ----

export function captureVideoFirstFrame(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "metadata";
    video.src = src;

    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 8000);

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener("loadeddata", () => {
      video.currentTime = 0.1;
    }, { once: true });

    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          cleanup();
          resolve(dataUrl);
          return;
        }
      } catch { /* CORS or tainted canvas */ }
      cleanup();
      resolve(null);
    }, { once: true });

    video.addEventListener("error", () => {
      cleanup();
      resolve(null);
    }, { once: true });
  });
}

export function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace(/^#/, "");
  // Short hex: #RGB → RRGGBB
  if (clean.length === 3 || clean.length === 4) {
    clean = clean[0]! + clean[0]! + clean[1]! + clean[1]! + clean[2]! + clean[2]!;
  }
  // 8-char hex with alpha: RRGGBBAA → RRGGBB
  if (clean.length === 8) {
    clean = clean.slice(0, 6);
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}
