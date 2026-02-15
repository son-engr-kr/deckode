import { useMemo } from "react";
import type { Slide, Animation } from "@/types/deck";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import { ElementRenderer } from "./ElementRenderer";

interface Props {
  slide: Slide;
  scale: number;
  animate?: boolean;
}

export function SlideRenderer({ slide, scale, animate }: Props) {
  const bg = slide.background;

  // Build element→animations lookup only when animating
  const animationMap = useMemo(() => {
    if (!animate || !slide.animations || slide.animations.length === 0) return null;
    const map = new Map<string, Animation[]>();
    for (const anim of slide.animations) {
      const list = map.get(anim.target);
      if (list) {
        list.push(anim);
      } else {
        map.set(anim.target, [anim]);
      }
    }
    return map;
  }, [animate, slide.animations]);

  return (
    <div
      style={{
        width: CANVAS_WIDTH * scale,
        height: CANVAS_HEIGHT * scale,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundColor: bg?.color ?? "#0f172a",
          backgroundImage: bg?.image ? `url(${bg.image})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {slide.elements.map((element) => (
          <ElementRenderer
            key={element.id}
            element={element}
            animations={animationMap?.get(element.id)}
          />
        ))}
      </div>
    </div>
  );
}
