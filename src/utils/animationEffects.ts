import type { AnimationEffect } from "@/types/deck";

export interface AnimationConfig {
  initial: Record<string, string | number>;
  animate: Record<string, string | number>;
}

const effects: Record<AnimationEffect, AnimationConfig> = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  fadeOut: {
    initial: { opacity: 1 },
    animate: { opacity: 0 },
  },
  slideInLeft: {
    initial: { x: -100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
  },
  slideInRight: {
    initial: { x: 100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
  },
  slideInUp: {
    initial: { y: 100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
  },
  slideInDown: {
    initial: { y: -100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
  },
  scaleIn: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
  },
  scaleOut: {
    initial: { scale: 1, opacity: 1 },
    animate: { scale: 0, opacity: 0 },
  },
  typewriter: {
    initial: { clipPath: "inset(0 100% 0 0)" },
    animate: { clipPath: "inset(0 0% 0 0)" },
  },
};

export function getAnimationConfig(effect: AnimationEffect): AnimationConfig {
  return effects[effect];
}
