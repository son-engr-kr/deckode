import { useEffect, useState, useCallback, useRef } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { setStoreAdapter } from "@/stores/deckStore";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { PresenterView } from "@/components/presenter/PresenterView";
import { ViewOnlyPresentation } from "@/components/presenter/ViewOnlyPresentation";
import { ProjectSelector } from "@/components/ProjectSelector";
import { AdapterProvider } from "@/contexts/AdapterContext";
import { ViteApiAdapter } from "@/adapters/viteApi";
import { ReadOnlyAdapter } from "@/adapters/readOnly";
import { loadDeckFromDisk } from "@/utils/api";
import { parseGitHubParam, buildGitHubRawBase, fetchGitHubDeck } from "@/utils/github";
import type { FileSystemAdapter } from "@/adapters/types";
import type { FsAccessAdapter } from "@/adapters/fsAccess";
import type { Deck } from "@/types/deck";
import { assert } from "@/utils/assert";

const IS_DEV = import.meta.env.DEV;

// Eagerly bundle external slide files for the ?demo mode
const exampleSlideFiles: Record<string, unknown> = import.meta.glob(
  "../projects/example/slides/*.json",
  { eager: true, import: "default" },
);

/** Resolve $ref entries in a deck using a lookup map keyed by ref path. */
function resolveSlideRefsFromMap(deck: Deck, basePath: string, fileMap: Record<string, unknown>): Deck {
  const resolved = structuredClone(deck);
  for (let i = 0; i < resolved.slides.length; i++) {
    const entry = resolved.slides[i] as any;
    if (entry.$ref && typeof entry.$ref === "string") {
      const key = basePath + entry.$ref.replace("./", "");
      const data = fileMap[key];
      if (data) {
        resolved.slides[i] = data as any;
      }
    }
  }
  return resolved;
}

export function App() {
  const currentProject = useDeckStore((s) => s.currentProject);
  const [adapter, setAdapter] = useState<FileSystemAdapter | null>(null);
  const [externalChange, setExternalChange] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Capture URL params once on mount
  const [isPresentMode] = useState(() => {
    return new URLSearchParams(window.location.search).get("mode") === "present";
  });

  const [isAudiencePopup] = useState(() => {
    const mode = new URLSearchParams(window.location.search).get("mode");
    return mode === "audience" || mode === "presenter";
  });

  // Helper to open a readonly adapter
  const openReadOnly = useCallback((readOnlyAdapter: ReadOnlyAdapter) => {
    setAdapter(readOnlyAdapter);
    setStoreAdapter(readOnlyAdapter);
    readOnlyAdapter.loadDeck().then((deck) => {
      useDeckStore.getState().openProject(readOnlyAdapter.projectName, deck);
    });
  }, []);

  // URL param routing on mount: ?demo, ?gh=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // ?demo → load bundled example deck
    if (params.has("demo")) {
      setLoading(true);
      import("../projects/example/deck.json").then((mod) => {
        const rawDeck = mod.default as unknown as Deck;
        const deck = resolveSlideRefsFromMap(rawDeck, "../projects/example/", exampleSlideFiles);
        const assetBaseUrl = import.meta.env.BASE_URL + "demo-assets";
        const readOnlyAdapter = ReadOnlyAdapter.fromBundled(deck, assetBaseUrl);
        openReadOnly(readOnlyAdapter);
        setLoading(false);
      });
      return;
    }

    // ?gh=owner/repo[/path][@branch] → fetch from GitHub
    const ghParam = params.get("gh");
    if (ghParam) {
      setLoading(true);
      const source = parseGitHubParam(ghParam);
      const rawBase = buildGitHubRawBase(source);
      fetchGitHubDeck(source)
        .then((deck) => {
          const name = `${source.owner}/${source.repo}`;
          const readOnlyAdapter = ReadOnlyAdapter.fromRemote(name, deck, rawBase + "/assets");
          openReadOnly(readOnlyAdapter);
          setLoading(false);
        })
        .catch((err) => {
          setLoadError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        });
      return;
    }
  }, [openReadOnly]);

  // In dev mode, auto-open project from URL query param
  useEffect(() => {
    if (!IS_DEV) return;
    const params = new URLSearchParams(window.location.search);
    // Skip if demo or gh param is present (handled above)
    if (params.has("demo") || params.has("gh")) return;
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

  // Sync URL when project changes (dev mode only)
  useEffect(() => {
    if (!IS_DEV) return;
    // Don't overwrite URL for demo/gh modes
    const params = new URLSearchParams(window.location.search);
    if (params.has("demo") || params.has("gh")) return;
    if (currentProject) {
      params.set("project", currentProject);
      history.replaceState(null, "", `?${params.toString()}`);
    } else {
      history.replaceState(null, "", window.location.pathname);
    }
  }, [currentProject]);

  // HMR: reload deck when deck.json changes on disk (dev mode only)
  useEffect(() => {
    if (!IS_DEV || !import.meta.hot) return;
    const handler = (data: { project: string }) => {
      const state = useDeckStore.getState();
      if (data.project !== state.currentProject || !adapter) return;

      if (!state.isDirty) {
        adapter.loadDeck().then((deck) => {
          useDeckStore.getState().loadDeck(deck);
        });
      } else {
        setExternalChange(true);
      }
    };
    import.meta.hot.on("deckode:deck-changed", handler);
    return () => {
      import.meta.hot!.off("deckode:deck-changed", handler);
    };
  }, [adapter]);

  // Polling: detect external deck.json changes in fs-access mode
  const lastModifiedRef = useRef(0);
  useEffect(() => {
    if (!adapter || adapter.mode !== "fs-access") return;
    const fsAdapter = adapter as FsAccessAdapter;

    const poll = async () => {
      const fileHandle = await fsAdapter.dirHandle.getFileHandle("deck.json");
      const file = await fileHandle.getFile();
      const modified = file.lastModified;

      if (lastModifiedRef.current === 0) {
        lastModifiedRef.current = modified;
        return;
      }

      if (modified === lastModifiedRef.current) return;
      lastModifiedRef.current = modified;

      if (Date.now() - fsAdapter.lastSaveTs < 2000) return;

      const state = useDeckStore.getState();
      if (!state.isDirty) {
        fsAdapter.loadDeck().then((deck) => {
          useDeckStore.getState().loadDeck(deck);
        });
      } else {
        setExternalChange(true);
      }
    };

    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [adapter]);

  const handleReloadExternal = useCallback(() => {
    if (!adapter) return;
    adapter.loadDeck().then((deck) => {
      useDeckStore.getState().loadDeck(deck);
      setExternalChange(false);
    });
  }, [adapter]);

  const handleKeepMine = useCallback(() => {
    setExternalChange(false);
  }, []);

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

  // Exit present mode → remove mode=present from URL, re-render as editor
  const handleExitPresent = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("mode");
    const qs = params.toString();
    history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    // Force re-render by reloading (simplest approach since isPresentMode is captured once)
    window.location.reload();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Loading deck...
      </div>
    );
  }

  // Load error state
  if (loadError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-red-400 mb-4">Failed to load deck</h1>
          <p className="text-sm text-zinc-400 mb-6">{loadError}</p>
          <button
            onClick={() => {
              history.replaceState(null, "", window.location.pathname);
              window.location.reload();
            }}
            className="px-4 py-2 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-sm"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <ProjectSelector
        isDevMode={IS_DEV}
        onAdapterReady={handleAdapterReady}
      />
    );
  }

  assert(adapter !== null, "Adapter must be set when a project is open");

  // Present mode (for shared links)
  if (isPresentMode) {
    return (
      <AdapterProvider adapter={adapter}>
        <ViewOnlyPresentation onExit={handleExitPresent} />
      </AdapterProvider>
    );
  }

  return (
    <AdapterProvider adapter={adapter}>
      {externalChange && adapter.mode !== "readonly" && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2 bg-amber-600 text-white text-sm font-medium shadow-lg">
          <span>deck.json was modified externally</span>
          <button
            onClick={handleReloadExternal}
            className="px-2 py-0.5 rounded bg-white text-amber-700 font-semibold hover:bg-amber-50 transition-colors"
          >
            Reload
          </button>
          <button
            onClick={handleKeepMine}
            className="px-2 py-0.5 rounded bg-amber-700 text-amber-100 hover:bg-amber-800 transition-colors"
          >
            Keep mine
          </button>
        </div>
      )}
      {isAudiencePopup ? <PresenterView /> : <EditorLayout />}
    </AdapterProvider>
  );
}
