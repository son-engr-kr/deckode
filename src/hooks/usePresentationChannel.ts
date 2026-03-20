import { useCallback, useEffect, useRef } from "react";
import type { Deck } from "@/types/deck";

export type PresentMessage =
  | { type: "navigate"; slideIndex: number; activeStep: number }
  | { type: "exit" }
  | { type: "sync-request" }
  | {
      type: "sync-deck";
      deck: Deck;
      project: string;
      slideIndex: number;
      activeStep: number;
      assetMap: Record<string, string>;
      assetBaseUrl: string;
    }
  | { type: "asset-update"; assetMap: Record<string, string> }
  | { type: "pointer"; x: number; y: number; visible: boolean }
  | { type: "video-control"; elementId: string; action: "play" | "pause"; currentTime: number };

interface Callbacks {
  onNavigate?: (slideIndex: number, activeStep: number) => void;
  onExit?: () => void;
  onSyncRequest?: () => void;
  onSyncDeck?: (
    deck: Deck,
    project: string,
    slideIndex: number,
    activeStep: number,
    assetMap: Record<string, string>,
    assetBaseUrl: string,
  ) => void;
  onAssetUpdate?: (assetMap: Record<string, string>) => void;
  onPointer?: (x: number, y: number, visible: boolean) => void;
  onVideoControl?: (elementId: string, action: "play" | "pause", currentTime: number) => void;
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
      } else if (msg.type === "sync-deck") {
        cbRef.current.onSyncDeck?.(
          msg.deck,
          msg.project,
          msg.slideIndex,
          msg.activeStep,
          msg.assetMap,
          msg.assetBaseUrl,
        );
      } else if (msg.type === "asset-update") {
        cbRef.current.onAssetUpdate?.(msg.assetMap);
      } else if (msg.type === "pointer") {
        cbRef.current.onPointer?.(msg.x, msg.y, msg.visible);
      } else if (msg.type === "video-control") {
        cbRef.current.onVideoControl?.(msg.elementId, msg.action, msg.currentTime);
      }
    };

    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, []);

  const postNavigate = useCallback((slideIndex: number, activeStep: number) => {
    channelRef.current?.postMessage({
      type: "navigate",
      slideIndex,
      activeStep,
    } satisfies PresentMessage);
  }, []);

  const postExit = useCallback(() => {
    channelRef.current?.postMessage({ type: "exit" } satisfies PresentMessage);
  }, []);

  const postSyncRequest = useCallback(() => {
    channelRef.current?.postMessage({
      type: "sync-request",
    } satisfies PresentMessage);
  }, []);

  const postSyncDeck = useCallback((
    deck: Deck,
    project: string,
    slideIndex: number,
    activeStep: number,
    assetMap: Record<string, string>,
    assetBaseUrl: string,
  ) => {
    channelRef.current?.postMessage({
      type: "sync-deck",
      deck,
      project,
      slideIndex,
      activeStep,
      assetMap,
      assetBaseUrl,
    } satisfies PresentMessage);
  }, []);

  const postAssetUpdate = useCallback((assetMap: Record<string, string>) => {
    channelRef.current?.postMessage({
      type: "asset-update",
      assetMap,
    } satisfies PresentMessage);
  }, []);

  const postPointer = useCallback((x: number, y: number, visible: boolean) => {
    channelRef.current?.postMessage({
      type: "pointer",
      x,
      y,
      visible,
    } satisfies PresentMessage);
  }, []);

  const postVideoControl = useCallback((elementId: string, action: "play" | "pause", currentTime: number) => {
    channelRef.current?.postMessage({
      type: "video-control",
      elementId,
      action,
      currentTime,
    } satisfies PresentMessage);
  }, []);

  return { postNavigate, postExit, postSyncRequest, postSyncDeck, postAssetUpdate, postPointer, postVideoControl };
}
