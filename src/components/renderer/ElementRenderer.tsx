import { useState } from "react";
import { motion } from "framer-motion";
import type { SlideElement, Animation } from "@/types/deck";
import { getAnimationConfig } from "@/utils/animationEffects";
import { TextElementRenderer } from "./elements/TextElement";
import { ImageElementRenderer } from "./elements/ImageElement";
import { CodeElementRenderer } from "./elements/CodeElement";
import { ShapeElementRenderer } from "./elements/ShapeElement";
import { VideoElementRenderer } from "./elements/VideoElement";

interface Props {
  element: SlideElement;
  animations?: Animation[];
}

export function ElementRenderer({ element, animations }: Props) {
  const transform = element.rotation ? `rotate(${element.rotation}deg)` : undefined;

  const positionStyle: React.CSSProperties = {
    left: element.position.x,
    top: element.position.y,
    width: element.size.w,
    height: element.size.h,
    transform,
  };

  const child = renderByType(element);

  // No animations → plain div (zero overhead in editor)
  if (!animations || animations.length === 0) {
    return (
      <div data-element-id={element.id} className="absolute" style={positionStyle}>
        {child}
      </div>
    );
  }

  const onEnter = animations.filter((a) => a.trigger === "onEnter");
  const onClick = animations.filter((a) => a.trigger === "onClick");

  return (
    <div data-element-id={element.id} className="absolute" style={positionStyle}>
      <AnimatedWrapper onEnter={onEnter} onClick={onClick}>
        {child}
      </AnimatedWrapper>
    </div>
  );
}

function AnimatedWrapper({
  onEnter,
  onClick,
  children,
}: {
  onEnter: Animation[];
  onClick: Animation[];
  children: React.ReactNode;
}) {
  const [clicked, setClicked] = useState(false);

  // Merge all onEnter animations into initial/animate
  let initial: Record<string, string | number> = {};
  let animate: Record<string, string | number> = {};
  let transition: Record<string, number> = {};

  for (const anim of onEnter) {
    const config = getAnimationConfig(anim.effect);
    initial = { ...initial, ...config.initial };
    animate = { ...animate, ...config.animate };
    transition = {
      duration: (anim.duration ?? 500) / 1000,
      delay: (anim.delay ?? 0) / 1000,
      ...transition,
    };
  }

  // onClick: apply animate state only after click
  for (const anim of onClick) {
    const config = getAnimationConfig(anim.effect);
    initial = { ...initial, ...config.initial };
    if (clicked) {
      animate = { ...animate, ...config.animate };
      transition = {
        duration: (anim.duration ?? 500) / 1000,
        delay: (anim.delay ?? 0) / 1000,
        ...transition,
      };
    }
  }

  const handleClick = onClick.length > 0 ? () => setClicked(true) : undefined;

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      onClick={handleClick}
      style={{ width: "100%", height: "100%" }}
    >
      {children}
    </motion.div>
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
    case "video":
      return <VideoElementRenderer element={element} />;
  }
}
