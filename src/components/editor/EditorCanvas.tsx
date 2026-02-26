import { useRef, useState, useEffect, useCallback } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { usePreviewStore } from "@/stores/previewStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import type { ImageElement, VideoElement } from "@/types/deck";
import { SelectionOverlay } from "./SelectionOverlay";
import { useAdapter } from "@/contexts/AdapterContext";
import { assert } from "@/utils/assert";

export function EditorCanvas() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const selectElement = useDeckStore((s) => s.selectElement);
  const addElement = useDeckStore((s) => s.addElement);
  const adapter = useAdapter();

  const previewAnimations = usePreviewStore((s) => s.animations);
  const previewDelayOverrides = usePreviewStore((s) => s.delayOverrides);
  const previewFlashTimes = usePreviewStore((s) => s.flashTimes);
  const previewKey = usePreviewStore((s) => s.key);
  const clearPreview = usePreviewStore((s) => s.clearPreview);

  const [flashActive, setFlashActive] = useState(false);

  // Auto-clear preview after animations complete
  useEffect(() => {
    if (!previewAnimations || previewAnimations.length === 0) return;
    const maxMs = previewAnimations.reduce(
      (max, a) => {
        const delay = previewDelayOverrides?.get(a) ?? (a.delay ?? 0);
        return Math.max(max, delay + (a.duration ?? 500));
      },
      0,
    );
    const timer = setTimeout(clearPreview, maxMs + 100);
    return () => clearTimeout(timer);
  }, [previewAnimations, previewDelayOverrides, previewKey, clearPreview]);

  // Schedule border flashes for onClick/onKey step boundaries
  useEffect(() => {
    if (previewFlashTimes.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const t of previewFlashTimes) {
      timers.push(setTimeout(() => setFlashActive(true), t));
      timers.push(setTimeout(() => setFlashActive(false), t + 300));
    }
    return () => timers.forEach(clearTimeout);
  }, [previewFlashTimes, previewKey]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);

  const updateScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const padding = 40;
    const availW = container.clientWidth - padding * 2;
    const availH = container.clientHeight - padding * 2;
    const scaleX = availW / CANVAS_WIDTH;
    const scaleY = availH / CANVAS_HEIGHT;
    setScale(Math.min(scaleX, scaleY, 1.5));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  // Clipboard paste: add image from Ctrl+V
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!deck) return;

      // Don't intercept paste in text inputs
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }

      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (!file) return;

      e.preventDefault();

      // Clipboard files often have generic names like "image.png"
      const ext = file.name.split(".").pop() || "png";
      const renamed = new File([file], `paste-${Date.now()}.${ext}`, {
        type: file.type,
      });

      const url = await adapter.uploadAsset(renamed);

      const slide = deck.slides[currentSlideIndex];
      assert(slide !== undefined, `Slide index ${currentSlideIndex} out of bounds`);

      const id = crypto.randomUUID();
      const element: ImageElement = {
        id,
        type: "image",
        src: url,
        position: { x: 330, y: 170 },
        size: { w: 300, h: 200 },
      };
      addElement(slide.id, element);
      selectElement(id);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [deck, currentSlideIndex, adapter, addElement, selectElement]);

  if (!deck) return null;

  const slide = deck.slides[currentSlideIndex];
  assert(slide !== undefined, `Slide index ${currentSlideIndex} out of bounds`);

  // Deselect all elements when clicking empty canvas space.
  // This fires on the wrapper (slide area + gray surround). InteractiveElement's
  // handleMouseDown calls stopPropagation, so element clicks never reach here.
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only primary button (left click)
    if (e.button !== 0) return;
    selectElement(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) return;

    const url = await adapter.uploadAsset(file);

    const wrapper = canvasWrapperRef.current;
    assert(wrapper !== null, "canvasWrapperRef not attached");
    const rect = wrapper.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / scale;
    const rawY = (e.clientY - rect.top) / scale;

    const elW = isImage ? 300 : 560;
    const elH = isImage ? 200 : 315;
    const x = Math.max(0, Math.min(rawX - elW / 2, CANVAS_WIDTH - elW));
    const y = Math.max(0, Math.min(rawY - elH / 2, CANVAS_HEIGHT - elH));

    const id = crypto.randomUUID();

    if (isImage) {
      const element: ImageElement = {
        id,
        type: "image",
        src: url,
        position: { x, y },
        size: { w: elW, h: elH },
      };
      addElement(slide.id, element);
    } else {
      const element: VideoElement = {
        id,
        type: "video",
        src: url,
        controls: true,
        position: { x, y },
        size: { w: elW, h: elH },
      };
      addElement(slide.id, element);
    }
    selectElement(id);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center bg-zinc-900 overflow-hidden"
      onMouseDown={handleCanvasMouseDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div ref={canvasWrapperRef} className="relative">
        <SlideRenderer
          slide={slide}
          scale={scale}
          theme={deck.theme}
          previewAnimations={previewAnimations ?? undefined}
          previewDelayOverrides={previewDelayOverrides ?? undefined}
          previewKey={previewKey}
        />
        <SelectionOverlay slide={slide} scale={scale} />
        {flashActive && (
          <div
            className="absolute inset-0 pointer-events-none rounded-sm"
            style={{
              boxShadow: "inset 0 0 0 3px rgba(59,130,246,0.8), 0 0 12px 2px rgba(59,130,246,0.4)",
              animation: "flash-fade 300ms ease-out forwards",
            }}
          />
        )}
      </div>
    </div>
  );
}
