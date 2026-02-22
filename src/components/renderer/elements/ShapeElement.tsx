import type { ShapeElement as ShapeElementType, ShapeStyle } from "@/types/deck";
import { useTheme, resolveStyle } from "@/contexts/ThemeContext";

interface Props {
  element: ShapeElementType;
}

export function ShapeElementRenderer({ element }: Props) {
  const theme = useTheme();
  const style = resolveStyle<ShapeStyle>(theme.shape, element.style);
  const { w, h } = element.size;

  if (element.shape === "ellipse") {
    // Inset radii by half the stroke width so the stroke doesn't get clipped at the edges
    const sw = style.strokeWidth ?? 1;
    const rx = Math.max(0, w / 2 - sw / 2);
    const ry = Math.max(0, h / 2 - sw / 2);
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={rx}
          ry={ry}
          fill={style.fill ?? "transparent"}
          stroke={style.stroke ?? "#ffffff"}
          strokeWidth={sw}
          opacity={style.opacity ?? 1}
        />
      </svg>
    );
  }

  if (element.shape === "line" || element.shape === "arrow") {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {element.shape === "arrow" && (
          <defs>
            <marker
              id={`arrow-${element.id}`}
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={style.stroke ?? "#ffffff"}
              />
            </marker>
          </defs>
        )}
        <line
          x1={0}
          y1={h / 2}
          x2={w}
          y2={h / 2}
          stroke={style.stroke ?? "#ffffff"}
          strokeWidth={style.strokeWidth ?? 2}
          opacity={style.opacity ?? 1}
          markerEnd={element.shape === "arrow" ? `url(#arrow-${element.id})` : undefined}
        />
      </svg>
    );
  }

  // Rectangle (default)
  return (
    <div
      style={{
        width: w,
        height: h,
        backgroundColor: style.fill ?? "transparent",
        border:
          style.stroke || style.strokeWidth
            ? `${style.strokeWidth ?? 1}px solid ${style.stroke ?? "#ffffff"}`
            : undefined,
        borderRadius: style.borderRadius ?? 0,
        opacity: style.opacity ?? 1,
      }}
    />
  );
}
