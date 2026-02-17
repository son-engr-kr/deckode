import { motion } from "framer-motion";
import type { SlideElement, Animation } from "@/types/deck";
import { getAnimationConfig } from "@/utils/animationEffects";
import { TextElementRenderer } from "./elements/TextElement";
import { ImageElementRenderer } from "./elements/ImageElement";
import { CodeElementRenderer } from "./elements/CodeElement";
import { ShapeElementRenderer } from "./elements/ShapeElement";
import { VideoElementRenderer } from "./elements/VideoElement";
import { TikZElementRenderer } from "./elements/TikZElement";

interface Props {
  element: SlideElement;
  animations?: Animation[];
  /** Set of animations that should be in their "animate" state (controlled by parent step logic) */
  activeAnimations?: Set<Animation>;
  thumbnail?: boolean;
}

export function ElementRenderer({ element, animations, activeAnimations, thumbnail }: Props) {
  const transform = element.rotation ? `rotate(${element.rotation}deg)` : undefined;

  const positionStyle: React.CSSProperties = {
    left: element.position.x,
    top: element.position.y,
    width: element.size.w,
    height: element.size.h,
    transform,
  };

  const child = renderByType(element, thumbnail);

  // No animations → plain div (zero overhead in editor)
  if (!animations || animations.length === 0) {
    return (
      <div data-element-id={element.id} className="absolute" style={positionStyle}>
        {child}
      </div>
    );
  }

  return (
    <div data-element-id={element.id} className="absolute" style={positionStyle}>
      <AnimatedWrapper animations={animations} activeAnimations={activeAnimations}>
        {child}
      </AnimatedWrapper>
    </div>
  );
}

function AnimatedWrapper({
  animations,
  activeAnimations,
  children,
}: {
  animations: Animation[];
  activeAnimations?: Set<Animation>;
  children: React.ReactNode;
}) {
  let initial: Record<string, string | number> = {};
  let animate: Record<string, string | number> = {};
  let transition: Record<string, number> = {};

  for (const anim of animations) {
    const config = getAnimationConfig(anim.effect);
    initial = { ...initial, ...config.initial };

    // onEnter: always activate. onClick: only if in activeAnimations set.
    const isActive =
      anim.trigger === "onEnter" ||
      (activeAnimations !== undefined && activeAnimations.has(anim));

    if (isActive) {
      animate = { ...animate, ...config.animate };
      transition = {
        duration: (anim.duration ?? 500) / 1000,
        delay: (anim.delay ?? 0) / 1000,
        ...transition,
      };
    }
  }

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      style={{ width: "100%", height: "100%" }}
    >
      {children}
    </motion.div>
  );
}

function renderByType(element: SlideElement, thumbnail?: boolean) {
  switch (element.type) {
    case "text":
      return <TextElementRenderer element={element} />;
    case "image":
      return <ImageElementRenderer element={element} />;
    case "code":
      return <CodeElementRenderer element={element} />;
    case "shape":
      return <ShapeElementRenderer element={element} />;
    case "video":
      return <VideoElementRenderer element={element} thumbnail={thumbnail} />;
    case "tikz":
      return <TikZElementRenderer element={element} thumbnail={thumbnail} />;
  }
}
