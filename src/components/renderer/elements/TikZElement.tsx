import { useState, useCallback } from "react";
import type { TikZElement as TikZElementType, TikZStyle } from "@/types/deck";
import { useTheme, resolveStyle } from "@/contexts/ThemeContext";
import { useAssetUrl } from "@/contexts/AdapterContext";
import { useDeckStore } from "@/stores/deckStore";

interface Props {
  element: TikZElementType;
  thumbnail?: boolean;
}

function isSvgFresh(element: TikZElementType): boolean {
  if (!element.svgUrl) return false;
  if (element.renderedContent === undefined) return false;
  return (
    element.content === element.renderedContent &&
    (element.preamble ?? "") === (element.renderedPreamble ?? "")
  );
}

export function TikZElementRenderer({ element, thumbnail }: Props) {
  const deckTheme = useTheme();
  const style = resolveStyle<TikZStyle>(deckTheme.tikz, element.style);
  const resolvedSvgUrl = useAssetUrl(element.svgUrl);
  const [imgBroken, setImgBroken] = useState(false);

  const handleImgError = useCallback(() => {
    setImgBroken(true);
    useDeckStore.getState().patchElementById(element.id, {
      svgUrl: undefined,
      renderedContent: undefined,
      renderedPreamble: undefined,
    } as Record<string, unknown>);
  }, [element.id]);

  if (isSvgFresh(element) && resolvedSvgUrl && !imgBroken) {
    return (
      <img
        src={resolvedSvgUrl}
        alt="TikZ diagram"
        onError={handleImgError}
        style={{
          width: element.size.w,
          height: element.size.h,
          objectFit: "contain",
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius ?? 0,
        }}
      />
    );
  }

  // Placeholder: show TikZ source preview
  return (
    <div
      style={{
        width: element.size.w,
        height: element.size.h,
        backgroundColor: style.backgroundColor ?? "#1e1e2e",
        borderRadius: style.borderRadius ?? 4,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
      }}
    >
      <div style={{ color: "#888", fontSize: thumbnail ? 8 : 12, marginBottom: 4 }}>
        TikZ (not rendered)
      </div>
      {!thumbnail && (
        <pre
          style={{
            color: "#aaa",
            fontSize: 9,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            overflow: "hidden",
            maxHeight: element.size.h - 30,
            textAlign: "left",
            width: "100%",
          }}
        >
          {element.content.slice(0, 300)}
        </pre>
      )}
    </div>
  );
}
