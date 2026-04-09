import { lazy, Suspense, useState, useCallback } from "react";
import type { ImageElement as ImageElementType, ImageStyle } from "@/types/deck";
import { useElementStyle } from "@/contexts/ThemeContext";
import { useAssetUrl } from "@/contexts/AdapterContext";
import { useDeckStore } from "@/stores/deckStore";

const PdfRenderer = lazy(() => import("./PdfRenderer"));

function isPdfSrc(src: string): boolean {
  const path = src.split("?")[0]!;
  return path.toLowerCase().endsWith(".pdf");
}

interface Props {
  element: ImageElementType;
  editorMode?: boolean;
}

export function ImageElementRenderer({ element }: Props) {
  const style = useElementStyle<ImageStyle>("image", element.style);
  const resolvedSrc = useAssetUrl(element.src);
  const isCropping = useDeckStore((s) => s.cropElementId === element.id);
  const [loadError, setLoadError] = useState(false);
  const handleError = useCallback(() => setLoadError(true), []);

  if (!resolvedSrc) return null;

  if (isPdfSrc(element.src)) {
    return (
      <Suspense
        fallback={
          <div
            style={{
              width: element.size.w,
              height: element.size.h,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#1a1a2e",
              color: "#666",
              fontSize: 14,
              borderRadius: style.borderRadius ?? 0,
              opacity: style.opacity ?? 1,
            }}
          >
            Loading PDF...
          </div>
        }
      >
        <PdfRenderer
          src={resolvedSrc}
          width={element.size.w}
          height={element.size.h}
          borderRadius={style.borderRadius ?? 0}
          opacity={style.opacity ?? 1}
        />
      </Suspense>
    );
  }

  const crop = style.crop;
  const hasCrop = !isCropping && crop && (crop.top || crop.right || crop.bottom || crop.left);
  const clipPath = hasCrop
    ? `inset(${crop.top * 100}% ${crop.right * 100}% ${crop.bottom * 100}% ${crop.left * 100}%)`
    : undefined;

  if (loadError) {
    return (
      <div
        style={{
          width: element.size.w,
          height: element.size.h,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          background: "#1e1e2e",
          borderRadius: style.borderRadius ?? 0,
          opacity: style.opacity ?? 1,
          border: style.border || "1px dashed #444",
          color: "#666",
          fontSize: Math.min(14, element.size.h * 0.12),
          overflow: "hidden",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="m3 16 5-5c.928-.893 2.072-.893 3 0l5 5" />
          <path d="m14 14 1-1c.928-.893 2.072-.893 3 0l3 3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
        </svg>
        <span style={{ maxWidth: "90%", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
          {element.src.split("/").pop() || "Image not found"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={element.alt ?? ""}
      draggable={false}
      onError={handleError}
      style={{
        width: element.size.w,
        height: element.size.h,
        objectFit: (style.objectFit ?? "fill") as React.CSSProperties["objectFit"],
        borderRadius: style.borderRadius ?? 0,
        opacity: style.opacity ?? 1,
        border: style.border,
        clipPath,
      }}
    />
  );
}
