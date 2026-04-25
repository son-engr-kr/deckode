import { useState, useEffect, useMemo } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { FsAccessAdapter } from "@/adapters/fsAccess";
import { ViteApiAdapter } from "@/adapters/viteApi";
import {
  restoreHandle,
  saveHandle,
  addRecentProject,
  listRecentProjects,
  removeRecentProject,
} from "@/utils/handleStore";
import type { RecentProject } from "@/utils/handleStore";
import {
  listProjects,
  createProject,
  deleteProject,
  loadDeckFromDisk,
} from "@/utils/api";
import { ProjectSettingsDialog } from "./editor/ProjectSettingsDialog";
import { NewProjectWizard } from "./NewProjectWizard";
import { GitHubDialog } from "./GitHubDialog";
import { DemoGallery } from "./DemoGallery";
import type { FileSystemAdapter } from "@/adapters/types";
import type { ProjectInfo } from "@/utils/api";
import type { NewProjectConfig } from "@/utils/projectTemplates";
import { assert } from "@/utils/assert";

// ── Per-project "last opened" tracker for Vite dev mode ──
// The server's listProjects() returns every directory under projects/ with
// no history. This small localStorage map lets us sort the list by recency
// and show the most-used ones first.

const VITE_RECENCY_KEY = "tekkal:vite-project-recency";

function getViteProjectRecency(): Record<string, number> {
  try {
    const raw = localStorage.getItem(VITE_RECENCY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function markViteProjectOpened(name: string): void {
  try {
    const map = getViteProjectRecency();
    map[name] = Date.now();
    localStorage.setItem(VITE_RECENCY_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable — non-fatal, ordering just falls back to name
  }
}

const DEFAULT_VISIBLE_PROJECTS = 5;
const DEFAULT_VISIBLE_RECENT_FOLDERS = 5;

interface Props {
  isDevMode: boolean;
  onAdapterReady: (adapter: FileSystemAdapter) => void;
}

export function ProjectSelector({ isDevMode, onAdapterReady }: Props) {
  if (isDevMode) {
    return <ViteProjectSelector onAdapterReady={onAdapterReady} />;
  }
  return <FsAccessProjectSelector onAdapterReady={onAdapterReady} />;
}

// ── Dev mode: Vite API project list ──

function ViteProjectSelector({ onAdapterReady }: { onAdapterReady: (adapter: FileSystemAdapter) => void }) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [ghDialogOpen, setGhDialogOpen] = useState(false);
  const [recentFolders, setRecentFolders] = useState<RecentProject[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [folderSearch, setFolderSearch] = useState("");
  const [showAllFolders, setShowAllFolders] = useState(false);
  // Bumped whenever handleOpen runs so the sorted list refreshes on navigation
  const [recencyTick, setRecencyTick] = useState(0);

  const fetchProjects = () => {
    listProjects().then((p) => {
      setProjects(p);
      setLoading(false);
    });
  };

  const loadRecentFolders = () => {
    listRecentProjects().then(setRecentFolders);
  };

  useEffect(() => { fetchProjects(); loadRecentFolders(); }, []);

  // Recency-aware sort: projects opened recently rank above those never opened;
  // ties (never opened) fall back to alphabetical by name.
  const sortedProjects = useMemo(() => {
    void recencyTick;
    const recency = getViteProjectRecency();
    return [...projects].sort((a, b) => {
      const ra = recency[a.name];
      const rb = recency[b.name];
      if (ra !== undefined && rb !== undefined) return rb - ra;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [projects, recencyTick]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return sortedProjects;
    return sortedProjects.filter((p) =>
      p.name.toLowerCase().includes(q) || p.title.toLowerCase().includes(q),
    );
  }, [sortedProjects, projectSearch]);

  const visibleProjects = useMemo(() => {
    if (projectSearch.trim() || showAllProjects) return filteredProjects;
    return filteredProjects.slice(0, DEFAULT_VISIBLE_PROJECTS);
  }, [filteredProjects, projectSearch, showAllProjects]);

  const filteredRecentFolders = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return recentFolders;
    return recentFolders.filter((f) => f.name.toLowerCase().includes(q));
  }, [recentFolders, folderSearch]);

  const visibleRecentFolders = useMemo(() => {
    if (folderSearch.trim() || showAllFolders) return filteredRecentFolders;
    return filteredRecentFolders.slice(0, DEFAULT_VISIBLE_RECENT_FOLDERS);
  }, [filteredRecentFolders, folderSearch, showAllFolders]);

  const handleOpen = async (name: string) => {
    const deck = await loadDeckFromDisk(name);
    assert(deck !== null, `Failed to load deck for project "${name}"`);
    markViteProjectOpened(name);
    setRecencyTick((t) => t + 1);
    const adapter = new ViteApiAdapter(name);
    onAdapterReady(adapter);
    useDeckStore.getState().openProject(name, deck);
    history.replaceState(null, "", `?project=${encodeURIComponent(name)}`);
  };

  const handleWizardConfirm = async (config: NewProjectConfig) => {
    assert(config.name !== undefined && config.name.length > 0, "Project name is required");
    setCreating(true);
    setWizardOpen(false);
    try {
      await createProject(config.name, config);
    } catch (err) {
      setCreating(false);
      alert(err instanceof Error ? err.message : String(err));
      return;
    }
    setCreating(false);
    await handleOpen(config.name);
  };

  const handleDelete = async (name: string) => {
    await deleteProject(name);
    fetchProjects();
  };

  const [renameTarget, setRenameTarget] = useState<ProjectInfo | null>(null);

  const openWithFsHandle = async (handle: FileSystemDirectoryHandle) => {
    await saveHandle(handle);
    await addRecentProject(handle);
    const adapter = new FsAccessAdapter(handle);
    const deck = await adapter.loadDeck();
    onAdapterReady(adapter);
    useDeckStore.getState().openProject(adapter.projectName, deck);
  };

  const handleOpenFolder = async () => {
    try {
      const adapter = await FsAccessAdapter.openDirectory();
      await addRecentProject(adapter.dirHandle);
      const deck = await adapter.loadDeck();
      onAdapterReady(adapter);
      useDeckStore.getState().openProject(adapter.projectName, deck);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      alert(e instanceof Error ? e.message : "Failed to open folder");
    }
  };

  const handleOpenRecentFolder = async (entry: RecentProject) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perm = await (entry.handle as any).requestPermission({ mode: "readwrite" });
      if (perm !== "granted") return;
      await openWithFsHandle(entry.handle);
    } catch {
      await removeRecentProject(entry.name);
      loadRecentFolders();
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Loading projects...
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="w-full max-w-5xl px-6">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6">TEKKAL Projects</h1>

        {projects.length === 0 && (
          <p className="text-sm text-zinc-500 mb-6">No projects yet. Create one below.</p>
        )}

        {projects.length > 0 && (
          <div className="mb-8">
            {projects.length > DEFAULT_VISIBLE_PROJECTS && (
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder={`Search ${projects.length} projects...`}
                className="w-full mb-2 px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              />
            )}
            <div className="space-y-2">
              {visibleProjects.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between px-4 py-3 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors group"
                >
                  <button
                    onClick={() => handleOpen(p.name)}
                    className="flex-1 text-left"
                  >
                    <span className="text-sm font-medium text-zinc-200">{p.title}</span>
                    <span className="text-xs text-zinc-500 ml-2">{p.name}</span>
                  </button>
                  <div className="flex items-center gap-3 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenameTarget(p); }}
                      className="text-xs text-zinc-600 hover:text-zinc-200 transition-colors"
                      title={`Rename ${p.name}`}
                    >
                      Rename
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.name); }}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                      title={`Delete ${p.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {projectSearch.trim() && filteredProjects.length === 0 && (
              <p className="text-xs text-zinc-600 mt-2">No projects match &quot;{projectSearch}&quot;.</p>
            )}
            {!projectSearch.trim() && !showAllProjects && filteredProjects.length > DEFAULT_VISIBLE_PROJECTS && (
              <button
                onClick={() => setShowAllProjects(true)}
                className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Show all {filteredProjects.length} projects
              </button>
            )}
            {!projectSearch.trim() && showAllProjects && filteredProjects.length > DEFAULT_VISIBLE_PROJECTS && (
              <button
                onClick={() => setShowAllProjects(false)}
                className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Show fewer
              </button>
            )}
          </div>
        )}

        {/* Recent local folders */}
        {recentFolders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Recent Local Folders</h2>
            {recentFolders.length > DEFAULT_VISIBLE_RECENT_FOLDERS && (
              <input
                type="text"
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                placeholder={`Search ${recentFolders.length} folders...`}
                className="w-full mb-2 px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              />
            )}
            <div className="space-y-1.5">
              {visibleRecentFolders.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors group"
                >
                  <button
                    onClick={() => handleOpenRecentFolder(entry)}
                    className="flex-1 text-left"
                  >
                    <span className="text-sm font-medium text-zinc-200">{entry.name}</span>
                    <span className="text-[11px] text-zinc-600 ml-2">
                      {formatRelativeTime(entry.openedAt)}
                    </span>
                  </button>
                  <button
                    onClick={async (e) => { e.stopPropagation(); await removeRecentProject(entry.name); loadRecentFolders(); }}
                    className="text-xs text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-3"
                    title="Remove from recents"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {folderSearch.trim() && filteredRecentFolders.length === 0 && (
              <p className="text-xs text-zinc-600 mt-2">No folders match &quot;{folderSearch}&quot;.</p>
            )}
            {!folderSearch.trim() && !showAllFolders && filteredRecentFolders.length > DEFAULT_VISIBLE_RECENT_FOLDERS && (
              <button
                onClick={() => setShowAllFolders(true)}
                className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Show all {filteredRecentFolders.length} folders
              </button>
            )}
            {!folderSearch.trim() && showAllFolders && filteredRecentFolders.length > DEFAULT_VISIBLE_RECENT_FOLDERS && (
              <button
                onClick={() => setShowAllFolders(false)}
                className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Show fewer
              </button>
            )}
          </div>
        )}

        {/* New project */}
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900 mb-6">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">New Project</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setWizardOpen(true)}
              disabled={creating}
              className="flex-1 px-4 py-2.5 rounded bg-blue-600 text-sm text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              {creating ? "Creating..." : "Create New Project"}
            </button>
            <button
              onClick={() => setGhDialogOpen(true)}
              className="px-4 py-2.5 rounded bg-zinc-700 border border-zinc-600 text-sm text-zinc-200 hover:bg-zinc-600 transition-colors"
            >
              Open from GitHub
            </button>
            <button
              onClick={handleOpenFolder}
              className="px-4 py-2.5 rounded bg-zinc-700 border border-zinc-600 text-sm text-zinc-200 hover:bg-zinc-600 transition-colors"
            >
              Open Folder
            </button>
          </div>
        </div>

        <DemoGallery />
      </div>

      <NewProjectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onConfirm={handleWizardConfirm}
        showNameField={true}
      />

      <GitHubDialog
        open={ghDialogOpen}
        onClose={() => setGhDialogOpen(false)}
      />

      {renameTarget && (
        <ProjectSettingsDialog
          projectName={renameTarget.name}
          projectTitle={renameTarget.title}
          showGitPath={false}
          onClose={() => setRenameTarget(null)}
          onRenamed={() => {
            setRenameTarget(null);
            fetchProjects();
          }}
        />
      )}
    </div>
  );
}

// ── Prod mode: File System Access ──

function FsAccessProjectSelector({ onAdapterReady }: { onAdapterReady: (adapter: FileSystemAdapter) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [ghDialogOpen, setGhDialogOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [recentSearch, setRecentSearch] = useState("");
  const [showAllRecent, setShowAllRecent] = useState(false);

  const loadRecentProjects = () => {
    listRecentProjects().then(setRecentProjects);
  };

  const filteredRecent = useMemo(() => {
    const q = recentSearch.trim().toLowerCase();
    if (!q) return recentProjects;
    return recentProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [recentProjects, recentSearch]);

  const visibleRecent = useMemo(() => {
    if (recentSearch.trim() || showAllRecent) return filteredRecent;
    return filteredRecent.slice(0, DEFAULT_VISIBLE_PROJECTS);
  }, [filteredRecent, recentSearch, showAllRecent]);

  // Try to auto-restore the most recently opened directory handle from IndexedDB
  useEffect(() => {
    restoreHandle()
      .then(async (handle) => {
        if (!handle) { setRestoring(false); loadRecentProjects(); return; }
        const adapter = FsAccessAdapter.fromHandle(handle);
        const deck = await adapter.loadDeck();
        await addRecentProject(handle);
        onAdapterReady(adapter);
        useDeckStore.getState().openProject(adapter.projectName, deck);
      })
      .catch((err) => {
        setRestoring(false);
        loadRecentProjects();
        if (err instanceof DOMException && err.name === "NotFoundError") {
          setError("Last opened folder no longer contains a deck.json file.");
          return;
        }
        // Permission denied or handle stale — fall through to manual picker
      });
  }, [onAdapterReady]);

  const openWithHandle = async (handle: FileSystemDirectoryHandle) => {
    await saveHandle(handle);
    await addRecentProject(handle);
    const adapter = new FsAccessAdapter(handle);
    const deck = await adapter.loadDeck();
    onAdapterReady(adapter);
    useDeckStore.getState().openProject(adapter.projectName, deck);
  };

  const handleOpenFolder = async () => {
    setError(null);
    try {
      const adapter = await FsAccessAdapter.openDirectory();
      // openDirectory() already calls saveHandle; also add to recents
      await addRecentProject(adapter.dirHandle);
      const deck = await adapter.loadDeck();
      onAdapterReady(adapter);
      useDeckStore.getState().openProject(adapter.projectName, deck);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof DOMException && err.name === "NotFoundError") {
        setError("This folder does not contain a deck.json file. A project folder must contain deck.json — make sure you opened the project folder itself, not its parent. To start fresh, use \"New Project\".");
        return;
      }
      throw err;
    }
  };

  const handleOpenRecent = async (entry: RecentProject) => {
    setError(null);
    try {
      // Re-verify permission
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perm = await (entry.handle as any).requestPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        setError(`Permission denied for "${entry.name}". Try opening the folder manually.`);
        return;
      }
      await openWithHandle(entry.handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotFoundError") {
        setError(`"${entry.name}" does not contain a deck.json file.`);
        return;
      }
      // Handle stale or removed — remove from recents
      await removeRecentProject(entry.name);
      loadRecentProjects();
      setError(`Could not reopen "${entry.name}". The folder may have been moved or deleted.`);
    }
  };

  const handleRemoveRecent = async (name: string) => {
    await removeRecentProject(name);
    loadRecentProjects();
  };

  const handleNewProject = async (config: NewProjectConfig) => {
    setWizardOpen(false);
    setError(null);
    setCreating(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const showDirectoryPicker = (window as any).showDirectoryPicker as (
        options?: { mode?: "read" | "readwrite" },
      ) => Promise<FileSystemDirectoryHandle>;
      const baseDir = await showDirectoryPicker({ mode: "readwrite" });

      const projectDir = await FsAccessAdapter.writeNewProject(baseDir, config);
      await openWithHandle(projectDir);
    } catch (err) {
      setCreating(false);
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      alert(message);
    }
  };

  if (restoring) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Restoring project...
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="w-full max-w-5xl px-6">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2 text-center">TEKKAL</h1>
        <p className="text-sm text-zinc-400 mb-6 text-center">
          Open an existing project or create a new one.
        </p>

        <div className="flex justify-center gap-3 mb-8">
          <button
            onClick={handleOpenFolder}
            className="px-6 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-700 transition-colors"
          >
            Open Project Folder
          </button>
          <button
            onClick={() => setWizardOpen(true)}
            disabled={creating}
            className="px-6 py-3 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {creating ? "Creating..." : "New Project"}
          </button>
          <button
            onClick={() => setGhDialogOpen(true)}
            className="px-6 py-3 rounded-lg bg-zinc-800 border border-zinc-600 text-sm font-medium text-zinc-200 hover:border-zinc-400 hover:bg-zinc-700 transition-colors"
          >
            Open from GitHub
          </button>
        </div>

        {recentProjects.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Recent Projects</h2>
            {recentProjects.length > DEFAULT_VISIBLE_PROJECTS && (
              <input
                type="text"
                value={recentSearch}
                onChange={(e) => setRecentSearch(e.target.value)}
                placeholder={`Search ${recentProjects.length} recent projects...`}
                className="w-full mb-2 px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
              />
            )}
            <div className="space-y-1.5">
              {visibleRecent.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors group"
                >
                  <button
                    onClick={() => handleOpenRecent(entry)}
                    className="flex-1 text-left"
                  >
                    <span className="text-sm font-medium text-zinc-200">{entry.name}</span>
                    <span className="text-[11px] text-zinc-600 ml-2">
                      {formatRelativeTime(entry.openedAt)}
                    </span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveRecent(entry.name); }}
                    className="text-xs text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-3"
                    title="Remove from recents"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {recentSearch.trim() && filteredRecent.length === 0 && (
              <p className="text-xs text-zinc-600 mt-2">No recent projects match &quot;{recentSearch}&quot;.</p>
            )}
            {!recentSearch.trim() && !showAllRecent && filteredRecent.length > DEFAULT_VISIBLE_PROJECTS && (
              <button
                onClick={() => setShowAllRecent(true)}
                className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Show all {filteredRecent.length} recent projects
              </button>
            )}
            {!recentSearch.trim() && showAllRecent && filteredRecent.length > DEFAULT_VISIBLE_PROJECTS && (
              <button
                onClick={() => setShowAllRecent(false)}
                className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Show fewer
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700 rounded p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mt-6">
          <DemoGallery />
        </div>

        <p className="mt-6 text-xs text-zinc-600 text-center">
          Static mode — file changes are saved directly to your local folder via the File System Access API.
        </p>
      </div>

      <NewProjectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onConfirm={handleNewProject}
        showNameField={true}
      />

      <GitHubDialog
        open={ghDialogOpen}
        onClose={() => setGhDialogOpen(false)}
      />
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
