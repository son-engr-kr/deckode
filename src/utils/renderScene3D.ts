/**
 * Scene3D export helper.
 *
 * Does NOT create any WebGL contexts. Reads from scene3dFrameCache only.
 * Call `warmScene3DCache()` before export to ensure all frames are cached
 * by temporarily navigating through slides with scene3d elements.
 */

import type { Deck, Scene3DElement } from "@/types/deck";
import { scene3dFrameCache } from "@/components/renderer/elements/Scene3DElement";

/** No-op — kept for API compat with export entry points. */
export function restoreLiveContexts(): void {}

/**
 * Return a cached PNG data-URL for a Scene3D element, or null.
 */
export async function renderScene3DToDataUrl(
  el: Scene3DElement,
): Promise<string | null> {
  return scene3dFrameCache.get(el.id) ?? null;
}

/**
 * Force-lose every live WebGL context on the page.
 * Frees context slots so the next Canvas can acquire one.
 */
function freeAllContexts(): void {
  for (const c of document.querySelectorAll("canvas") as NodeListOf<HTMLCanvasElement>) {
    const gl =
      (c.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (c.getContext("webgl") as WebGLRenderingContext | null);
    if (gl && !gl.isContextLost()) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  }
}

/**
 * Pre-warm scene3dFrameCache for every scene3d element in the deck.
 *
 * Works by programmatically switching the active slide so the editor's
 * existing R3F Canvas renders each scene and FrameCapturer caches the frame.
 * No extra WebGL context is ever created.
 */
export async function warmScene3DCache(
  deck: Deck,
  setSlideIndex: (i: number) => void,
  currentIndex: number,
): Promise<void> {
  const visible = deck.slides.filter((s) => !s.hidden);

  // Collect all scene3d element IDs
  const allScene3dIds: string[] = [];
  const slideMap: { si: number; ids: string[] }[] = [];
  for (let si = 0; si < visible.length; si++) {
    const ids = visible[si]!.elements
      .filter((e) => e.type === "scene3d")
      .map((e) => e.id);
    if (ids.length > 0) {
      slideMap.push({ si, ids });
      allScene3dIds.push(...ids);
    }
  }

  if (allScene3dIds.length === 0) return;

  for (const id of allScene3dIds) {
    scene3dFrameCache.delete(id);
  }

  freeAllContexts();
  await sleep(300);

  for (const { si, ids } of slideMap) {
    setSlideIndex(si);
    await sleep(500);
    await waitForCache(ids, 5000);
    freeAllContexts();
    await sleep(300);
  }

  setSlideIndex(currentIndex);
  await sleep(200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForCache(ids: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (ids.every((id) => scene3dFrameCache.has(id))) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        console.warn(
          "[3D Export] Cache warm timeout for:",
          ids.filter((id) => !scene3dFrameCache.has(id)),
        );
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}
