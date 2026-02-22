import { useEffect, useState, useCallback } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { setStoreAdapter } from "@/stores/deckStore";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { PresenterView } from "@/components/presenter/PresenterView";
import { ProjectSelector } from "@/components/ProjectSelector";
import { AdapterProvider } from "@/contexts/AdapterContext";
import { ViteApiAdapter } from "@/adapters/viteApi";
import { loadDeckFromDisk } from "@/utils/api";
import type { FileSystemAdapter } from "@/adapters/types";

const IS_DEV = import.meta.env.DEV;

export function App() {
  const currentProject = useDeckStore((s) => s.currentProject);
  const [adapter, setAdapter] = useState<FileSystemAdapter | null>(null);

  // In dev mode, auto-open project from URL query param
  useEffect(() => {
    if (!IS_DEV) return;
    const params = new URLSearchParams(window.location.search);
    const project = params.get("project");
    if (project) {
      const viteAdapter = new ViteApiAdapter(project);
      setAdapter(viteAdapter);
      setStoreAdapter(viteAdapter);
      loadDeckFromDisk(project).then((deck) => {
        if (deck) useDeckStore.getState().openProject(project, deck);
      });
    }
  }, []);

  const isPresenterMode =
    new URLSearchParams(window.location.search).get("mode") === "presenter";

  // Sync URL when project changes (dev mode only)
  useEffect(() => {
    if (!IS_DEV) return;
    if (currentProject) {
      const params = new URLSearchParams(window.location.search);
      params.set("project", currentProject);
      history.replaceState(null, "", `?${params.toString()}`);
    } else {
      history.replaceState(null, "", window.location.pathname);
    }
  }, [currentProject]);

  // HMR: reload deck when AI modifies it via API (dev mode only)
  useEffect(() => {
    if (!IS_DEV || !import.meta.hot) return;
    const handler = (data: { project: string }) => {
      const state = useDeckStore.getState();
      if (data.project !== state.currentProject || !adapter) return;
      adapter.loadDeck().then((deck) => {
        useDeckStore.getState().replaceDeck(deck);
      });
    };
    import.meta.hot.on("deckode:deck-changed", handler);
    return () => {
      import.meta.hot!.off("deckode:deck-changed", handler);
    };
  }, [adapter]);

  const handleAdapterReady = useCallback((newAdapter: FileSystemAdapter) => {
    setAdapter(newAdapter);
    setStoreAdapter(newAdapter);
  }, []);

  // Clear adapter when project is closed (prod mode)
  useEffect(() => {
    if (!currentProject && !IS_DEV) {
      setAdapter(null);
      setStoreAdapter(null);
    }
  }, [currentProject]);

  if (!currentProject) {
    return (
      <ProjectSelector
        isDevMode={IS_DEV}
        onAdapterReady={handleAdapterReady}
      />
    );
  }

  assert(adapter !== null, "Adapter must be set when a project is open");

  return (
    <AdapterProvider adapter={adapter}>
      {isPresenterMode ? <PresenterView /> : <EditorLayout />}
    </AdapterProvider>
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[App] ${message}`);
}
