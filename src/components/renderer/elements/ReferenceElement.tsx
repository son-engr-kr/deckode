import { useDeckStore } from "@/stores/deckStore";
import type { ReferenceElement as ReferenceElementType } from "@/types/deck";
import { ElementRenderer } from "../ElementRenderer";

interface Props {
  element: ReferenceElementType;
  editorMode?: boolean;
}

export function ReferenceElementRenderer({ element, editorMode }: Props) {
  const component = useDeckStore(
    (s) => s.deck?.components?.[element.componentId],
  );

  if (!component) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2a1a1a",
          color: "#f87171",
          fontSize: 12,
          borderRadius: 4,
          border: "1px dashed #f87171",
        }}
      >
        Missing component
      </div>
    );
  }

  const scaleX = element.size.w / component.size.w;
  const scaleY = element.size.h / component.size.h;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          width: component.size.w,
          height: component.size.h,
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: "top left",
          position: "relative",
        }}
      >
        {component.elements.map((child) => (
          <ElementRenderer
            key={child.id}
            element={child}
            editorMode={editorMode}
          />
        ))}
      </div>
      {/* Badge to indicate shared component in editor */}
      {editorMode && (
        <div
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            background: "rgba(99, 102, 241, 0.85)",
            color: "#fff",
            fontSize: 9,
            padding: "1px 4px",
            borderRadius: 3,
            pointerEvents: "none",
            lineHeight: "14px",
          }}
        >
          {component.name}
        </div>
      )}
    </div>
  );
}
