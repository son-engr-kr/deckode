import { useState, useEffect } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { FsAccessAdapter } from "@/adapters/fsAccess";
import { ViteApiAdapter } from "@/adapters/viteApi";
import { restoreHandle } from "@/utils/handleStore";
import {
  listProjects,
  createProject,
  deleteProject,
  loadDeckFromDisk,
} from "@/utils/api";
import type { FileSystemAdapter } from "@/adapters/types";
import type { ProjectInfo } from "@/utils/api";

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
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");
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

  const handleCreate = async () => {
    const trimmed = newName.trim();
    assert(trimmed.length > 0, "Project name is required");
    assert(/^[a-zA-Z0-9_-]+$/.test(trimmed), "Project name may only contain letters, digits, hyphens, and underscores");
    setCreating(true);
    await createProject(trimmed, newTitle.trim() || undefined);
    setNewName("");
    setNewTitle("");
    setCreating(false);
    await handleOpen(trimmed);
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

        {/* New project form */}
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">New Project</h2>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="project-name (letters, digits, hyphens)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) handleCreate(); }}
              className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <input
              type="text"
              placeholder="Title (optional)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) handleCreate(); }}
              className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="mt-1 px-4 py-2 rounded bg-blue-600 text-sm text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Prod mode: File System Access ──

function FsAccessProjectSelector({ onAdapterReady }: { onAdapterReady: (adapter: FileSystemAdapter) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  // Try to auto-restore a previously opened directory handle from IndexedDB
  useEffect(() => {
    restoreHandle()
      .then(async (handle) => {
        if (!handle) { setRestoring(false); return; }
        const adapter = FsAccessAdapter.fromHandle(handle);
        const deck = await adapter.loadDeck();
        onAdapterReady(adapter);
        useDeckStore.getState().openProject(adapter.projectName, deck);
      })
      .catch(() => {
        // Permission denied or handle stale — fall through to manual picker
        setRestoring(false);
      });
  }, [onAdapterReady]);

  const handleOpenFolder = async () => {
    setError(null);
    try {
      const adapter = await FsAccessAdapter.openDirectory();
      // Verify deck.json exists by loading it
      const deck = await adapter.loadDeck();
      onAdapterReady(adapter);
      useDeckStore.getState().openProject(adapter.projectName, deck);
    } catch (err) {
      // User cancelled the directory picker
      if (err instanceof DOMException && err.name === "AbortError") return;
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
      <div className="w-full max-w-lg px-6 text-center">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Deckode</h1>
        <p className="text-sm text-zinc-400 mb-8">
          Open a project folder containing a <code className="text-zinc-300">deck.json</code> file.
        </p>

        <button
          onClick={handleOpenFolder}
          className="px-6 py-3 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          Open Project Folder
        </button>

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700 rounded p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <p className="mt-8 text-xs text-zinc-600">
          Static mode — file changes are saved directly to your local folder via the File System Access API.
        </p>
      </div>
    </div>
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[ProjectSelector] ${message}`);
}
