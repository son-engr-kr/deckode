import type { Slide } from "@/types/deck";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import { ElementRenderer } from "./ElementRenderer";

interface Props {
  slide: Slide;
  scale: number;
}

export function SlideRenderer({ slide, scale }: Props) {
  const bg = slide.background;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        backgroundColor: bg?.color ?? "#0f172a",
        backgroundImage: bg?.image ? `url(${bg.image})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {slide.elements.map((element) => (
        <ElementRenderer key={element.id} element={element} />
      ))}
    </div>
  );
}
