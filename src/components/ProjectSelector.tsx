import { useState, useEffect } from "react";
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
import { NewProjectWizard } from "./NewProjectWizard";
import type { FileSystemAdapter } from "@/adapters/types";
import type { ProjectInfo } from "@/utils/api";
import type { NewProjectConfig } from "@/utils/projectTemplates";

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

  const fetchProjects = () => {
    listProjects().then((p) => {
      setProjects(p);
      setLoading(false);
    });
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleOpen = async (name: string) => {
    const deck = await loadDeckFromDisk(name);
    assert(deck !== null, `Failed to load deck for project "${name}"`);
    const adapter = new ViteApiAdapter(name);
    onAdapterReady(adapter);
    useDeckStore.getState().openProject(name, deck);
    history.replaceState(null, "", `?project=${encodeURIComponent(name)}`);
  };

  const handleWizardConfirm = async (config: NewProjectConfig) => {
    assert(config.name !== undefined && config.name.length > 0, "Project name is required");
    setCreating(true);
    setWizardOpen(false);
    await createProject(config.name, config);
    setCreating(false);
    await handleOpen(config.name);
  };

  const handleDelete = async (name: string) => {
    await deleteProject(name);
    fetchProjects();
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Loading projects...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="w-full max-w-lg px-6">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6">Deckode Projects</h1>

        {projects.length === 0 && (
          <p className="text-sm text-zinc-500 mb-6">No projects yet. Create one below.</p>
        )}

        <div className="space-y-2 mb-8">
          {projects.map((p) => (
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
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(p.name); }}
                className="text-xs text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-3"
                title={`Delete ${p.name}`}
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        {/* New project */}
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">New Project</h2>
          <button
            onClick={() => setWizardOpen(true)}
            disabled={creating}
            className="w-full px-4 py-2.5 rounded bg-blue-600 text-sm text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {creating ? "Creating..." : "Create New Project"}
          </button>
        </div>
      </div>

      <NewProjectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onConfirm={handleWizardConfirm}
        showNameField={true}
      />
    </div>
  );
}

// ── Prod mode: File System Access ──

function FsAccessProjectSelector({ onAdapterReady }: { onAdapterReady: (adapter: FileSystemAdapter) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  const loadRecentProjects = () => {
    listRecentProjects().then(setRecentProjects);
  };

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
      .catch(() => {
        // Permission denied or handle stale — fall through to manual picker
        setRestoring(false);
        loadRecentProjects();
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
      if (err instanceof DOMException && err.name === "AbortError") {
        setCreating(false);
        return;
      }
      setCreating(false);
      throw err;
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
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="w-full max-w-lg px-6">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2 text-center">Deckode</h1>
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
        </div>

        {recentProjects.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Recent Projects</h2>
            <div className="space-y-1.5">
              {recentProjects.map((entry) => (
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
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700 rounded p-3 text-sm text-red-400">
            {error}
          </div>
        )}

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

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[ProjectSelector] ${message}`);
}
