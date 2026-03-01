import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Grid, Line } from "@react-three/drei";
import * as THREE from "three";
import type {
  Scene3DElement,
  Scene3DObject,
  Scene3DConfig,
  Scene3DKeyframe,
  Scene3DMaterial,
} from "@/types/deck";
import { useElementStyle } from "@/contexts/ThemeContext";
import type { Scene3DStyle } from "@/types/deck";

interface Props {
  element: Scene3DElement;
  sceneStep: number;
  thumbnail?: boolean;
}

// Compute the resolved state of a single object at a given keyframe step.
// Applies keyframe changes cumulatively from step 0..sceneStep.
function resolveObjectState(
  baseObj: Scene3DObject,
  keyframes: Scene3DKeyframe[],
  sceneStep: number,
): {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  material: Scene3DMaterial;
  visible: boolean;
  points?: [number, number, number][];
} {
  let position: [number, number, number] = baseObj.position ?? [0, 0, 0];
  let rotation: [number, number, number] = baseObj.rotation ?? [0, 0, 0];
  let scale: [number, number, number] = baseObj.scale ?? [1, 1, 1];
  let material: Scene3DMaterial = { ...baseObj.material };
  let visible = baseObj.visible ?? true;
  let points = baseObj.points;

  for (let i = 0; i < sceneStep && i < keyframes.length; i++) {
    const kf = keyframes[i]!;
    for (const change of kf.changes) {
      if (change.target !== baseObj.id) continue;
      if (change.position) position = change.position;
      if (change.rotation) rotation = change.rotation;
      if (change.scale) scale = change.scale;
      if (change.material) material = { ...material, ...change.material };
      if (change.visible !== undefined) visible = change.visible;
      if (change.points) points = change.points;
    }
  }

  return { position, rotation, scale, material, visible, points };
}

// Compute camera state at a given keyframe step.
function resolveCameraState(
  config: Scene3DConfig,
  keyframes: Scene3DKeyframe[],
  sceneStep: number,
): { position: [number, number, number]; target: [number, number, number]; fov: number } {
  let position: [number, number, number] = config.camera?.position ?? [5, 5, 5];
  let target: [number, number, number] = config.camera?.target ?? [0, 0, 0];
  let fov = config.camera?.fov ?? 50;

  for (let i = 0; i < sceneStep && i < keyframes.length; i++) {
    const kf = keyframes[i]!;
    if (kf.camera) {
      if (kf.camera.position) position = kf.camera.position;
      if (kf.camera.target) target = kf.camera.target;
      if (kf.camera.fov !== undefined) fov = kf.camera.fov;
    }
  }

  return { position, target, fov };
}

// Individual 3D object component with animated transitions
function SceneObject({
  baseObj,
  keyframes,
  sceneStep,
  transitionDuration,
}: {
  baseObj: Scene3DObject;
  keyframes: Scene3DKeyframe[];
  sceneStep: number;
  transitionDuration: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const state = useMemo(
    () => resolveObjectState(baseObj, keyframes, sceneStep),
    [baseObj, keyframes, sceneStep],
  );

  // Animate towards target state
  useFrame((_frameState, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const speed = 1 / Math.max(transitionDuration / 1000, 0.1);
    const t = Math.min(delta * speed * 3, 1);

    mesh.position.lerp(
      new THREE.Vector3(...state.position),
      t,
    );
    // Slerp rotation
    const targetQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...state.rotation),
    );
    mesh.quaternion.slerp(targetQuat, t);
    mesh.scale.lerp(new THREE.Vector3(...state.scale), t);

    mesh.visible = state.visible;

    // Animate material
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (state.material.opacity !== undefined) {
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, state.material.opacity, t);
      mat.transparent = mat.opacity < 1;
    }
  });

  const geometry = useMemo(() => {
    switch (baseObj.geometry) {
      case "box": return <boxGeometry />;
      case "sphere": return <sphereGeometry args={[0.5, 32, 32]} />;
      case "cylinder": return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      case "cone": return <coneGeometry args={[0.5, 1, 32]} />;
      case "torus": return <torusGeometry args={[0.4, 0.15, 16, 32]} />;
      case "plane": return <planeGeometry args={[1, 1]} />;
    }
  }, [baseObj.geometry]);

  const color = state.material.color ?? "#888888";
  const opacity = state.material.opacity ?? 1;

  return (
    <group>
      <mesh
        ref={meshRef}
        position={state.position}
        rotation={state.rotation}
        scale={state.scale}
        visible={state.visible}
      >
        {geometry}
        <meshStandardMaterial
          color={color}
          wireframe={state.material.wireframe ?? false}
          metalness={state.material.metalness ?? 0.1}
          roughness={state.material.roughness ?? 0.7}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      {baseObj.label && state.visible && (
        <Text
          position={[
            state.position[0],
            state.position[1] + (state.scale[1] ?? 1) * 0.7,
            state.position[2],
          ]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="bottom"
        >
          {baseObj.label}
        </Text>
      )}
    </group>
  );
}

// Line object component using drei's Line (fat lines via Line2)
function SceneLineObject({
  baseObj,
  keyframes,
  sceneStep,
}: {
  baseObj: Scene3DObject;
  keyframes: Scene3DKeyframe[];
  sceneStep: number;
}) {
  const state = useMemo(
    () => resolveObjectState(baseObj, keyframes, sceneStep),
    [baseObj, keyframes, sceneStep],
  );

  const pts = state.points ?? baseObj.points ?? [];
  if (pts.length < 2) return null;

  const color = state.material.color ?? "#888888";
  const lineWidth = state.material.lineWidth ?? 2;
  const opacity = state.material.opacity ?? 1;

  return (
    <group position={state.position} rotation={state.rotation} scale={state.scale} visible={state.visible}>
      <Line
        points={pts}
        color={color}
        lineWidth={lineWidth}
        opacity={opacity}
        transparent={opacity < 1}
      />
      {baseObj.label && state.visible && (
        <Text
          position={[0, (state.scale[1] ?? 1) * 0.5, 0]}
          fontSize={0.2}
          color={color}
          anchorX="center"
          anchorY="bottom"
        >
          {baseObj.label}
        </Text>
      )}
    </group>
  );
}

// Camera controller that animates to target position
function CameraController({
  position,
  target,
  fov,
  transitionDuration,
}: {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  transitionDuration: number;
}) {
  useFrame(({ camera }, delta) => {
    const speed = 1 / Math.max(transitionDuration / 1000, 0.1);
    const t = Math.min(delta * speed * 3, 1);

    camera.position.lerp(new THREE.Vector3(...position), t);
    (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp(
      (camera as THREE.PerspectiveCamera).fov,
      fov,
      t,
    );
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

    // Look at target
    const currentTarget = new THREE.Vector3();
    camera.getWorldDirection(currentTarget);
    const desiredTarget = new THREE.Vector3(...target);
    const lookTarget = new THREE.Vector3().lerpVectors(
      new THREE.Vector3().addVectors(camera.position, currentTarget),
      desiredTarget,
      t,
    );
    camera.lookAt(lookTarget);
  });

  return null;
}

export function Scene3DElementRenderer({ element, sceneStep, thumbnail }: Props) {
  const style = useElementStyle<Scene3DStyle>("scene3d", element.style);
  const { scene, keyframes = [] } = element;

  const borderRadius = style.borderRadius ?? 0;

  // Thumbnail mode: static placeholder (avoids WebGL context + CSS transform sizing issues)
  if (thumbnail) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius,
          overflow: "hidden",
          background: scene.background ?? "#1a1a2e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" stroke="none" fill="none" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      </div>
    );
  }

  const cameraState = useMemo(
    () => resolveCameraState(scene, keyframes, sceneStep),
    [scene, keyframes, sceneStep],
  );

  // Get transition duration from current keyframe (if any)
  const transitionDuration = useMemo(() => {
    if (sceneStep > 0 && sceneStep <= keyframes.length) {
      return keyframes[sceneStep - 1]!.duration ?? 500;
    }
    return 500;
  }, [sceneStep, keyframes]);

  // R3F Canvas has an internal ResizeObserver that causes two problems when the
  // slide container uses CSS transform: scale():
  //   1. getBoundingClientRect() returns the scaled-down size → viewport shrinks
  //   2. During fullscreen transitions the observer fires rapidly, causing layout
  //      feedback loops that make the slide list panel oscillate in size.
  //
  // Fix: position the Canvas absolutely inside a relative container. This removes
  // it from normal layout flow, so its ResizeObserver cannot affect flex siblings.
  // offsetSize: true ensures it reads offsetWidth/Height (immune to CSS transforms).
  const resizeConfig = useMemo(
    () => ({ offsetSize: true, scroll: false }),
    [],
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <Canvas
          camera={{
            position: cameraState.position,
            fov: cameraState.fov,
          }}
          style={{ background: scene.background ?? "transparent" }}
          gl={{ preserveDrawingBuffer: true }}
          resize={resizeConfig}
        >
        {/* Lights */}
        <ambientLight intensity={scene.ambientLight ?? 0.5} />
        {scene.directionalLight && (
          <directionalLight
            position={scene.directionalLight.position}
            intensity={scene.directionalLight.intensity ?? 0.8}
          />
        )}

        {/* Camera animation */}
        <CameraController
          position={cameraState.position}
          target={cameraState.target}
          fov={cameraState.fov}
          transitionDuration={transitionDuration}
        />

        {/* Objects */}
        {scene.objects.map((obj) =>
          obj.geometry === "line" ? (
            <SceneLineObject
              key={obj.id}
              baseObj={obj}
              keyframes={keyframes}
              sceneStep={sceneStep}
            />
          ) : (
            <SceneObject
              key={obj.id}
              baseObj={obj}
              keyframes={keyframes}
              sceneStep={sceneStep}
              transitionDuration={transitionDuration}
            />
          ),
        )}

        {/* Helpers */}
        {scene.helpers?.grid && (
          <Grid
            infiniteGrid
            fadeDistance={20}
            cellSize={1}
            sectionSize={5}
            cellColor="#aaaaaa"
            sectionColor="#888888"
          />
        )}
        {scene.helpers?.axes && <axesHelper args={[5]} />}

        {/* Orbit controls */}
        {scene.orbitControls && <OrbitControls />}
      </Canvas>
      </div>
    </div>
  );
}
