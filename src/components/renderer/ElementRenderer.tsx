import type { SlideElement } from "@/types/deck";
import { TextElementRenderer } from "./elements/TextElement";
import { ImageElementRenderer } from "./elements/ImageElement";
import { CodeElementRenderer } from "./elements/CodeElement";
import { ShapeElementRenderer } from "./elements/ShapeElement";

interface Props {
  element: SlideElement;
}

export function ElementRenderer({ element }: Props) {
  const transform = element.rotation ? `rotate(${element.rotation}deg)` : undefined;

  return (
    <div
      data-element-id={element.id}
      className="absolute"
      style={{
        left: element.position.x,
        top: element.position.y,
        width: element.size.w,
        height: element.size.h,
        transform,
      }}
    >
      {renderByType(element)}
    </div>
  );
}

function renderByType(element: SlideElement) {
  switch (element.type) {
    case "text":
      return <TextElementRenderer element={element} />;
    case "image":
      return <ImageElementRenderer element={element} />;
    case "code":
      return <CodeElementRenderer element={element} />;
    case "shape":
      return <ShapeElementRenderer element={element} />;
  }
}
