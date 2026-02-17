import type { TikZElement as TikZElementType } from "@/types/deck";

interface Props {
  element: TikZElementType;
  thumbnail?: boolean;
}

export function TikZElementRenderer({ element, thumbnail }: Props) {
  const style = element.style ?? {};

  if (element.svgUrl) {
    return (
      <img
        src={element.svgUrl}
        alt="TikZ diagram"
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
