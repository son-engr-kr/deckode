import type { ImageElement as ImageElementType } from "@/types/deck";

interface Props {
  element: ImageElementType;
}

export function ImageElementRenderer({ element }: Props) {
  const style = element.style ?? {};

  return (
    <img
      src={element.src}
      alt=""
      style={{
        width: element.size.w,
        height: element.size.h,
        objectFit: (style.objectFit ?? "contain") as React.CSSProperties["objectFit"],
        borderRadius: style.borderRadius ?? 0,
        opacity: style.opacity ?? 1,
        border: style.border,
      }}
    />
  );
}
