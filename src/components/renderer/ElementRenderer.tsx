import { lazy, Suspense, memo, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { motion } from "framer-motion";
import type { SlideElement, Animation, Scene3DElement } from "@/types/deck";
import { getAnimationConfig } from "@/utils/animationEffects";
import { getElementPositionStyle } from "@/utils/elementStyle";
import { TextElementRenderer } from "./elements/TextElement";
import { ImageElementRenderer } from "./elements/ImageElement";
import { CodeElementRenderer } from "./elements/CodeElement";
import { ShapeElementRenderer } from "./elements/ShapeElement";
import { VideoElementRenderer } from "./elements/VideoElement";
import { TikZElementRenderer } from "./elements/TikZElement";
import { TableElementRenderer } from "./elements/TableElement";
import { CustomElementRenderer } from "./elements/CustomElement";
import { ReferenceElementRenderer } from "./elements/ReferenceElement";

const Scene3DElementRenderer = lazy(() =>
  import("./elements/Scene3DElement").then((m) => ({ default: m.Scene3DElementRenderer })),
);

const MermaidElementRenderer = lazy(() =>
  import("./elements/MermaidElement").then((m) => ({ default: m.MermaidElementRenderer })),
);

interface Props {
  element: SlideElement;
  animations?: Animation[];
  /** Set of animations that should be in their "animate" state (controlled by parent step logic) */
  activeAnimations?: Set<Animation>;
  /** Computed delay overrides for afterPrevious animations (ms) */
  delayOverrides?: Map<Animation, number>;
  thumbnail?: boolean;
  /** When true, disables onEnter auto-activation — only activeAnimations fire */
  previewMode?: boolean;
  /** Incrementing counter to force AnimatedWrapper remount for replay */
  previewKey?: number;
  /** Skip absolute positioning — parent handles position (e.g. MorphTransition) */
  noPosition?: boolean;
  /** Suppress autoplay for videos in editor */
  editorMode?: boolean;
}

// ── Error boundary for individual elements ──

class ElementErrorBoundary extends Component<
  { elementId: string; elementType: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ElementRenderer] Crash in element "${this.props.elementId}" (${this.props.elementType}):`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#2a1215",
            border: "1px solid #7f1d1d",
            borderRadius: 4,
            padding: 6,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ color: "#f87171", fontSize: 11, fontWeight: 600 }}>
            Element error: {this.props.elementType}/{this.props.elementId}
          </div>
          <pre style={{ color: "#fca5a5", fontSize: 9, fontFamily: "monospace", whiteSpace: "pre-wrap", margin: 0, overflow: "auto" }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export const ElementRenderer = memo(function ElementRenderer({ element, animations, activeAnimations, delayOverrides, thumbnail, previewMode, previewKey, noPosition, editorMode }: Props) {
  // Guard against malformed elements (missing position/size)
  if (!noPosition && (!element.position || !element.size)) {
    return (
      <div data-element-id={element.id} className="absolute" style={{ left: 0, top: 0, width: 200, height: 40 }}>
        <div style={{ backgroundColor: "#2a1215", border: "1px solid #7f1d1d", borderRadius: 4, padding: 6, color: "#f87171", fontSize: 11, fontWeight: 600 }}>
          Invalid element: {element.type}/{element.id} (missing {!element.position ? "position" : "size"})
        </div>
      </div>
    );
  }

  const positionStyle = noPosition
    ? { width: "100%" as const, height: "100%" as const }
    : getElementPositionStyle(element);
  const child = renderByType(element, thumbnail, animations, activeAnimations, editorMode);

  const wrapped = (
    <ElementErrorBoundary elementId={element.id} elementType={element.type}>
      {child}
    </ElementErrorBoundary>
  );

  // No animations → plain div (zero overhead in editor)
  if (!animations || animations.length === 0) {
    return (
      <div data-element-id={element.id} className={noPosition ? undefined : "absolute"} style={positionStyle}>
        {wrapped}
      </div>
    );
  }

  return (
    <div data-element-id={element.id} className={noPosition ? undefined : "absolute"} style={positionStyle}>
      <AnimatedWrapper
        key={previewKey}
        animations={animations}
        activeAnimations={activeAnimations}
        delayOverrides={delayOverrides}
        previewMode={previewMode}
      >
        {wrapped}
      </AnimatedWrapper>
    </div>
  );
});

function AnimatedWrapper({
  animations,
  activeAnimations,
  delayOverrides,
  previewMode,
  children,
}: {
  animations: Animation[];
  activeAnimations?: Set<Animation>;
  delayOverrides?: Map<Animation, number>;
  previewMode?: boolean;
  children: React.ReactNode;
}) {
  let initial: Record<string, string | number> = {};
  let transition: Record<string, number> = {};

  // First pass: merge all initial states
  for (const anim of animations) {
    const config = getAnimationConfig(anim.effect);
    initial = { ...initial, ...config.initial };
  }

  // Start animate from initial — non-active animations stay hidden.
  // Active animations overlay their animate values on top.
  let animate: Record<string, string | number> = { ...initial };

  for (const anim of animations) {
    const config = getAnimationConfig(anim.effect);

    // In preview mode, only activate animations explicitly in activeAnimations set.
    // In normal mode, onEnter always activates; others need activeAnimations.
    const isActive = previewMode
      ? activeAnimations !== undefined && activeAnimations.has(anim)
      : anim.trigger === "onEnter" ||
        (activeAnimations !== undefined && activeAnimations.has(anim));

    if (isActive) {
      animate = { ...animate, ...config.animate };
      const delayMs = delayOverrides?.get(anim) ?? (anim.delay ?? 0);
      transition = {
        duration: (anim.duration ?? 500) / 1000,
        delay: delayMs / 1000,
        ...transition,
      };
    }
  }

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      style={{ ...initial, width: "100%", height: "100%" }}
    >
      {children}
    </motion.div>
  );
}

function computeSceneStep(
  element: Scene3DElement,
  animations?: Animation[],
  activeAnimations?: Set<Animation>,
): number {
  if (!animations || !activeAnimations) return 0;
  let step = 0;
  for (const anim of animations) {
    if (anim.target === element.id && anim.effect === "scene3dStep" && activeAnimations.has(anim)) {
      step++;
    }
  }
  return step;
}

function computeVideoStep(
  animations?: Animation[],
  activeAnimations?: Set<Animation>,
): number | undefined {
  if (!animations) return undefined;
  const hasPlayVideo = animations.some((a) => a.effect === "playVideo");
  if (!hasPlayVideo) return undefined;
  if (!activeAnimations) return 0;
  let step = 0;
  for (const anim of animations) {
    if (anim.effect === "playVideo" && activeAnimations.has(anim)) {
      step++;
    }
  }
  return step;
}

function renderByType(
  element: SlideElement,
  thumbnail?: boolean,
  animations?: Animation[],
  activeAnimations?: Set<Animation>,
  editorMode?: boolean,
) {
  switch (element.type) {
    case "text":
      return <TextElementRenderer element={element} />;
    case "image":
      return <ImageElementRenderer element={element} editorMode={editorMode} />;
    case "code":
      return <CodeElementRenderer element={element} />;
    case "shape":
      return <ShapeElementRenderer element={element} />;
    case "video": {
      const videoStep = computeVideoStep(animations, activeAnimations);
      return <VideoElementRenderer element={element} thumbnail={thumbnail} videoStep={videoStep} editorMode={editorMode} />;
    }
    case "tikz":
      return <TikZElementRenderer element={element} thumbnail={thumbnail} />;
    case "table":
      return <TableElementRenderer element={element} />;
    case "custom":
      return <CustomElementRenderer element={element} />;
    case "mermaid":
      return (
        <Suspense fallback={<div style={{ width: "100%", height: "100%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: 14 }}>Loading Mermaid...</div>}>
          <MermaidElementRenderer element={element} thumbnail={thumbnail} />
        </Suspense>
      );
    case "scene3d": {
      const sceneStep = computeSceneStep(element, animations, activeAnimations);
      return (
        <Suspense fallback={<div style={{ width: "100%", height: "100%", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: 14 }}>Loading 3D...</div>}>
          <Scene3DElementRenderer element={element} sceneStep={sceneStep} thumbnail={thumbnail} />
        </Suspense>
      );
    }
    case "reference":
      return <ReferenceElementRenderer element={element} editorMode={editorMode} />;
  }
}
