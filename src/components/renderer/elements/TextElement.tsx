import type { TextElement as TextElementType } from "@/types/deck";
import { renderMarkdown } from "@/utils/markdown";

interface Props {
  element: TextElementType;
}

export function TextElementRenderer({ element }: Props) {
  const style = element.style ?? {};
  const verticalAlign = style.verticalAlign ?? "top";
  const alignItems = { top: "flex-start", middle: "center", bottom: "flex-end" }[verticalAlign];

  return (
    <div
      className="flex overflow-hidden"
      style={{
        width: element.size.w,
        height: element.size.h,
        fontFamily: style.fontFamily ?? "Inter, system-ui, sans-serif",
        fontSize: style.fontSize ?? 24,
        color: style.color ?? "#ffffff",
        textAlign: (style.textAlign ?? "left") as React.CSSProperties["textAlign"],
        lineHeight: style.lineHeight ?? 1.5,
        alignItems,
      }}
    >
      <div className="w-full">{renderMarkdown(element.content)}</div>
    </div>
  );
}
