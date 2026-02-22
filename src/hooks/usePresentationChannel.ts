import { useEffect, useRef } from "react";

export type PresentMessage =
  | { type: "navigate"; slideIndex: number; activeStep: number }
  | { type: "exit" }
  | { type: "sync-request" }
  | { type: "pointer"; x: number; y: number; visible: boolean };

interface Callbacks {
  onNavigate?: (slideIndex: number, activeStep: number) => void;
  onExit?: () => void;
  onSyncRequest?: () => void;
  onPointer?: (x: number, y: number, visible: boolean) => void;
}

export function usePresentationChannel(callbacks: Callbacks) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const ch = new BroadcastChannel("deckode-present");
    channelRef.current = ch;

    ch.onmessage = (e: MessageEvent<PresentMessage>) => {
      const msg = e.data;
      if (msg.type === "navigate") {
        cbRef.current.onNavigate?.(msg.slideIndex, msg.activeStep);
      } else if (msg.type === "exit") {
        cbRef.current.onExit?.();
      } else if (msg.type === "sync-request") {
        cbRef.current.onSyncRequest?.();
      } else if (msg.type === "pointer") {
        cbRef.current.onPointer?.(msg.x, msg.y, msg.visible);
      }
    };

    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, []);

  const postNavigate = (slideIndex: number, activeStep: number) => {
    channelRef.current?.postMessage({
      type: "navigate",
      slideIndex,
      activeStep,
    } satisfies PresentMessage);
  };

  const postExit = () => {
    channelRef.current?.postMessage({ type: "exit" } satisfies PresentMessage);
  };

  const postSyncRequest = () => {
    channelRef.current?.postMessage({
      type: "sync-request",
    } satisfies PresentMessage);
  };

  const postPointer = (x: number, y: number, visible: boolean) => {
    channelRef.current?.postMessage({
      type: "pointer",
      x,
      y,
      visible,
    } satisfies PresentMessage);
  };

  return { postNavigate, postExit, postSyncRequest, postPointer };
}
