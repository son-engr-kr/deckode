import type { SlideElement, ImageElement, VideoElement, TikZElement, Slide } from "@/types/deck";
import type { FileSystemAdapter } from "@/adapters/types";

/**
 * Resolve a relative asset path (e.g. `./assets/foo.png`) to a fetchable URL
 * on the remote instance, using the remote project name for path mapping.
 */
function resolveRemoteUrl(src: string, remoteOrigin: string, remoteProject: string): string | null {
  // ./assets/foo.png → /assets/{remoteProject}/foo.png (matches Vite static middleware)
  if (src.startsWith("./assets/")) {
    return `${remoteOrigin}/assets/${remoteProject}/${src.slice(9)}`;
  }
  // Already absolute server path like /assets/proj/foo.png
  if (src.startsWith("/")) {
    return `${remoteOrigin}${src}`;
  }
  return null;
}

/**
 * Fetch a single asset from a remote Deckode instance and re-upload locally.
 * Returns the new local path, or the original on failure.
 */
async function reuploadAsset(
  src: string,
  remoteOrigin: string,
  remoteProject: string,
  adapter: FileSystemAdapter,
): Promise<string> {
  if (!src || src.startsWith("data:") || /^https?:\/\//.test(src)) return src;
  const url = resolveRemoteUrl(src, remoteOrigin, remoteProject);
  if (!url) return src;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return src;
    const blob = await resp.blob();
    const filename = src.split("/").pop()?.split("?")[0] || "asset.bin";
    const file = new File([blob], filename, { type: blob.type });
    return await adapter.uploadAsset(file);
  } catch {
    return src;
  }
}

/** Re-upload all asset references in an element (image src, video src, tikz svgUrl). */
export async function reuploadElementAssets(
  el: SlideElement,
  remoteOrigin: string,
  remoteProject: string,
  adapter: FileSystemAdapter,
): Promise<void> {
  if (el.type === "image" || el.type === "video") {
    const typed = el as ImageElement | VideoElement;
    typed.src = await reuploadAsset(typed.src, remoteOrigin, remoteProject, adapter);
  } else if (el.type === "tikz") {
    const typed = el as TikZElement;
    if (typed.svgUrl) typed.svgUrl = await reuploadAsset(typed.svgUrl, remoteOrigin, remoteProject, adapter);
  }
}

/** Re-upload all assets in a slide (elements + background image). */
export async function reuploadSlideAssets(
  slide: Slide,
  remoteOrigin: string,
  remoteProject: string,
  adapter: FileSystemAdapter,
): Promise<void> {
  for (const el of slide.elements) {
    await reuploadElementAssets(el, remoteOrigin, remoteProject, adapter);
  }
  if (slide.background?.image) {
    slide.background.image = await reuploadAsset(slide.background.image, remoteOrigin, remoteProject, adapter);
  }
}
