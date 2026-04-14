import { useEffect, useState, useCallback, useRef } from "react";
import { useDeckStore, getDeckDragging, getLastSaveTime } from "@/stores/deckStore";
import { setStoreAdapter } from "@/stores/deckStore";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { PresenterView } from "@/components/presenter/PresenterView";
import { ViewOnlyPresentation } from "@/components/presenter/ViewOnlyPresentation";
import { ProjectSelector } from "@/components/ProjectSelector";
import { AdapterProvider } from "@/contexts/AdapterContext";
import { GitDiffProvider } from "@/contexts/GitDiffContext";
import { ViteApiAdapter } from "@/adapters/viteApi";
import { ReadOnlyAdapter } from "@/adapters/readOnly";
import { loadDeckFromDisk } from "@/utils/api";
import { parseGitHubParam, buildGitHubRawBase, fetchGitHubDeck } from "@/utils/github";
import { restoreHandle, clearHandle, setTabProject, skipNextRestore } from "@/utils/handleStore";
import type { FileSystemAdapter } from "@/adapters/types";
import { FsAccessAdapter } from "@/adapters/fsAccess";
import { ProjectLoadErrorBoundary } from "@/components/ProjectLoadErrorBoundary";
import { normalizeDeckLegacyFields, type Deck } from "@/types/deck";
import { assert } from "@/utils/assert";
import { fnv1aHash } from "@/utils/hash";

const IS_DEV = import.meta.env.DEV;

// Eagerly bundle external slide files for the ?demo mode
const demoSlideFiles: Record<string, unknown> = import.meta.glob(
  "../templates/default/slides/*.json",
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
  const pendingConflict = useDeckStore((s) => s.pendingConflict);
  const [adapter, setAdapter] = useState<FileSystemAdapter | null>(null);
  const [externalChange, setExternalChange] = useState(false);
  const [mergedToast, setMergedToast] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Recovery banner shown on the project picker after a project
  // either failed to load (parse error) or threw at first render
  // (broken deck.json from an agentic tool benchmark, etc.). Set
  // by the async load catch and by ProjectLoadErrorBoundary.
  const [projectCrash, setProjectCrash] = useState<{ project: string; message: string } | null>(null);
  const mergedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronously detect if we need to auto-open from URL so we can show
  // a loading state immediately and prevent ProjectSelector from mounting.
  const [loading, setLoading] = useState(() => {
    if (!IS_DEV) return false;
    const params = new URLSearchParams(window.location.search);
    return !params.has("demo") && !params.has("gh") && params.has("project");
  });

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

    // ?demo → load bundled template deck
    if (params.has("demo")) {
      setLoading(true);
      import("../templates/default/deck.json").then((mod) => {
        const rawDeck = normalizeDeckLegacyFields(mod.default);
        const deck = resolveSlideRefsFromMap(rawDeck, "../templates/default/", demoSlideFiles);
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

  // In dev mode, auto-open project from URL query param.
  // `loading` is already true (set synchronously in useState) to block ProjectSelector.
  // Tries Vite API first; falls back to IndexedDB FsAccess handle restoration.
  const autoOpenProjectRef = useRef(
    IS_DEV ? new URLSearchParams(window.location.search).get("project") : null,
  );
  useEffect(() => {
    const project = autoOpenProjectRef.current;
    if (!project) return;

    const tryViteApi = async (): Promise<boolean> => {
      const deck = await loadDeckFromDisk(project);
      if (!deck) return false;
      const viteAdapter = new ViteApiAdapter(project);
      setAdapter(viteAdapter);
      setStoreAdapter(viteAdapter);
      useDeckStore.getState().openProject(project, deck);
      return true;
    };

    const tryFsAccessRestore = async (): Promise<boolean> => {
      const handle = await restoreHandle();
      if (!handle) return false;
      const fsAdapter = FsAccessAdapter.fromHandle(handle);
      const deck = await fsAdapter.loadDeck();
      setAdapter(fsAdapter);
      setStoreAdapter(fsAdapter);
      useDeckStore.getState().openProject(fsAdapter.projectName, deck);
      return true;
    };

    tryFsAccessRestore()
      .then((ok) => ok || tryViteApi())
      .catch((err) => {
        // Async load failure (broken JSON, unreadable file, schema
        // crash inside loadDeck). Clear the persisted handle and
        // fall back to the project picker so the user is not stuck
        // in a reload loop on the same broken project.
        const message = err instanceof Error ? err.message : String(err);
        console.error("[auto-open] project load failed:", err);
        recoverFromProjectCrash(project, message);
        return false;
      })
      .then(() => setLoading(false));
  }, []);

  // Centralized recovery: clear every persisted "last opened project"
  // bit (IndexedDB handle, sessionStorage tab project, in-memory store
  // adapter + deck) and surface a banner on the next render. Both the
  // async load catch and the ErrorBoundary go through here so the
  // recovery path stays in one place.
  const recoverFromProjectCrash = useCallback((projectName: string, message: string) => {
    skipNextRestore();
    setTabProject(null);
    void clearHandle();
    setStoreAdapter(null);
    setAdapter(null);
    useDeckStore.getState().closeProject();
    // Strip ?project=... from the URL so a manual refresh does not
    // immediately re-trigger the auto-restore effect.
    if (IS_DEV) {
      const params = new URLSearchParams(window.location.search);
      params.delete("project");
      const qs = params.toString();
      history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }
    setProjectCrash({ project: projectName, message });
  }, []);

  // Sync URL when project changes (dev mode only).
  // Write ?project= so the auto-open effect can restore on refresh
  // (tries Vite API first, then falls back to IndexedDB FsAccess handle).
  const hadProjectRef = useRef(false);
  useEffect(() => {
    if (!IS_DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("demo") || params.has("gh")) return;
    if (currentProject) {
      hadProjectRef.current = true;
      params.set("project", currentProject);
      history.replaceState(null, "", `?${params.toString()}`);
    } else if (hadProjectRef.current) {
      history.replaceState(null, "", window.location.pathname);
    }
  }, [currentProject]);

  // Try element-level merge; fall back to conflict dialog if same element modified both sides
  const tryMerge = useCallback((remoteDeck: Deck) => {
    const result = useDeckStore.getState().mergeExternalChange(remoteDeck);
    if (result === "merged") {
      // Translucent overlay toast that fades in then out so the
      // user notices the auto-merge without being blocked by it.
      if (mergedToastTimerRef.current) clearTimeout(mergedToastTimerRef.current);
      setMergedToast(true);
      mergedToastTimerRef.current = setTimeout(() => setMergedToast(false), 2200);
    } else if (result === "conflict") {
      setExternalChange(true);
    }
  }, []);

  useEffect(() => () => {
    if (mergedToastTimerRef.current) clearTimeout(mergedToastTimerRef.current);
  }, []);

  // HMR: reload deck when deck.json changes on disk (dev mode only)
  useEffect(() => {
    if (!IS_DEV || !import.meta.hot) return;
    const handler = (data: { project: string }) => {
      const state = useDeckStore.getState();
      if (data.project !== state.currentProject || !adapter) return;

      adapter.loadDeck().then((remoteDeck) => {
        tryMerge(remoteDeck);
      });
    };
    import.meta.hot.on("tekkal:deck-changed", handler);
    return () => {
      import.meta.hot!.off("tekkal:deck-changed", handler);
    };
  }, [adapter, tryMerge]);

  // Polling: detect external changes to deck.json and $ref slide files in fs-access mode
  const lastModifiedRef = useRef(0);
  const slideModifiedRef = useRef(new Map<string, number>());
  useEffect(() => {
    if (!adapter || adapter.mode !== "fs-access") return;
    const fsAdapter = adapter as FsAccessAdapter;

    const poll = async () => {
      // Skip polling during drag or shortly after save to avoid self-detection loops
      if (getDeckDragging()) return;
      if (Date.now() - getLastSaveTime() < 3000) return;
      // Check deck.json
      let deckChanged = false;
      const fileHandle = await fsAdapter.dirHandle.getFileHandle("deck.json");
      const file = await fileHandle.getFile();
      const modified = file.lastModified;

      if (lastModifiedRef.current === 0) {
        lastModifiedRef.current = modified;
      } else if (modified !== lastModifiedRef.current) {
        lastModifiedRef.current = modified;
        const text = await file.text();
        const fileHash = fnv1aHash(text);
        if (fileHash !== fsAdapter.lastSaveHash) {
          deckChanged = true;
        }
      }

      // Check $ref slide files
      if (!deckChanged) {
        const deck = useDeckStore.getState().deck;
        if (deck) {
          for (const slide of deck.slides) {
            if (!slide._ref) continue;
            try {
              const refParts = slide._ref.replace(/^\.\//, "").split("/");
              let dir: FileSystemDirectoryHandle = fsAdapter.dirHandle;
              for (let j = 0; j < refParts.length - 1; j++) {
                dir = await dir.getDirectoryHandle(refParts[j]!);
              }
              const fh = await dir.getFileHandle(refParts[refParts.length - 1]!);
              const f = await fh.getFile();
              const prev = slideModifiedRef.current.get(slide._ref);
              if (prev === undefined) {
                slideModifiedRef.current.set(slide._ref, f.lastModified);
              } else if (f.lastModified !== prev) {
                slideModifiedRef.current.set(slide._ref, f.lastModified);
                // Check if this is our own save by comparing content with cache
                const content = await f.text();
                const slideId = (slide as any).id ?? slide._ref;
                if (fsAdapter.isSlideRefCached(slideId, content)) continue; // self-save, skip
                deckChanged = true;
                break;
              }
            } catch {
              // File doesn't exist — skip
            }
          }
        }
      }

      if (deckChanged) {
        // Skip polling merge while a save is in progress to avoid race conditions
        if (useDeckStore.getState().isSaving) return;
        fsAdapter.loadDeck().then((remoteDeck) => {
          slideModifiedRef.current.clear();
          tryMerge(remoteDeck);
        });
      }
    };

    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [adapter, tryMerge]);

  const handleReloadExternal = useCallback(() => {
    if (!adapter) return;
    // Prefer the deck the store already has parked from the failed
    // save merge — saves a round-trip and guarantees we reload the
    // exact version that caused the conflict (avoids a race where a
    // third edit lands between the conflict and the reload click).
    const parked = useDeckStore.getState().pendingConflict;
    const apply = (deck: Deck) => {
      useDeckStore.getState().loadDeck(deck);
      useDeckStore.getState().clearPendingConflict();
      useDeckStore.getState().setSavePaused(false);
      setExternalChange(false);
    };
    if (parked) {
      apply(parked);
    } else {
      adapter.loadDeck().then(apply);
    }
  }, [adapter]);

  const handleKeepMine = useCallback(() => {
    useDeckStore.getState().clearPendingConflict();
    useDeckStore.getState().setSavePaused(false);
    setExternalChange(false);
    useDeckStore.getState().saveToDisk();
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

  // Audience/presenter popup: always render directly.
  // PresenterView manages its own adapter via BroadcastChannel sync.
  if (isAudiencePopup) {
    return <PresenterView />;
  }

  if (!currentProject) {
    return (
      <>
        {projectCrash && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] max-w-2xl px-4 py-3 rounded-lg bg-red-600/95 text-white text-sm shadow-xl border border-red-400">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold mb-0.5">
                  Project &quot;{projectCrash.project}&quot; failed to load
                </div>
                <div className="text-red-100 text-xs break-words font-mono">
                  {projectCrash.message}
                </div>
                <div className="text-red-200 text-[11px] mt-1">
                  Auto-reopen has been cleared. Pick a project below — the failed one will not reopen on reload.
                </div>
              </div>
              <button
                onClick={() => setProjectCrash(null)}
                className="shrink-0 text-red-200 hover:text-white"
                title="Dismiss"
              >
                &times;
              </button>
            </div>
          </div>
        )}
        <ProjectSelector
          isDevMode={IS_DEV}
          onAdapterReady={handleAdapterReady}
        />
      </>
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
      {adapter.mode !== "readonly" && (
        <div
          className={`pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-[9998] px-4 py-2 rounded-full bg-emerald-600/70 text-white text-sm font-medium shadow-lg backdrop-blur-sm transition-opacity duration-500 ${
            mergedToast ? "opacity-100" : "opacity-0"
          }`}
        >
          External change merged
        </div>
      )}
      {(externalChange || pendingConflict) && adapter.mode !== "readonly" && (
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
      <ProjectLoadErrorBoundary
        // Re-mount on project switch so a previous crash does not stick.
        key={currentProject}
        onError={(err) => {
          const message = err instanceof Error ? err.message : String(err);
          recoverFromProjectCrash(currentProject, message);
        }}
      >
        {isAudiencePopup ? <PresenterView /> : import.meta.env.DEV
          ? <GitDiffProvider><EditorLayout /></GitDiffProvider>
          : <EditorLayout />}
      </ProjectLoadErrorBoundary>
    </AdapterProvider>
  );
}
