import { useState, useEffect } from "react";
import { renameProject } from "@/utils/api";

const STORAGE_KEY = "tekkal-project-paths";
const LEGACY_STORAGE_KEY = "deckode-project-paths";

function readPathMap(): Record<string, string> {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy !== null) {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        raw = legacy;
      }
    }
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function getStoredProjectPath(projectName: string): string | null {
  return readPathMap()[projectName] ?? null;
}

function setStoredProjectPath(projectName: string, absPath: string | null) {
  try {
    const data = readPathMap();
    if (absPath) {
      data[projectName] = absPath;
    } else {
      delete data[projectName];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

function moveStoredProjectPath(oldName: string, newName: string) {
  if (oldName === newName) return;
  try {
    const data = readPathMap();
    if (data[oldName] !== undefined) {
      data[newName] = data[oldName]!;
      delete data[oldName];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // localStorage unavailable
  }
}

interface ProjectSettingsDialogProps {
  projectName: string;
  /** Current display title (deck.meta.title). Optional — if omitted, rename section only
   *  allows changing the folder name. */
  projectTitle?: string;
  /** Whether to show the local-path (git diff) section. Defaults to true. */
  showGitPath?: boolean;
  onClose: () => void;
  /** Fires after a successful rename (folder and/or title). */
  onRenamed?: (result: { newName: string; newTitle: string | null }) => void;
  /** Fires after a path is saved, so the caller can re-fetch git diffs. */
  onPathSaved?: () => void;
}

export function ProjectSettingsDialog({
  projectName,
  projectTitle,
  showGitPath = true,
  onClose,
  onRenamed,
  onPathSaved,
}: ProjectSettingsDialogProps) {
  const [folderName, setFolderName] = useState(projectName);
  const [title, setTitle] = useState(projectTitle ?? "");
  const [pathValue, setPathValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFolderName(projectName);
    setTitle(projectTitle ?? "");
    setPathValue(getStoredProjectPath(projectName) ?? "");
    setError(null);
  }, [projectName, projectTitle]);

  const folderChanged = folderName.trim() !== projectName;
  const titleChanged = projectTitle !== undefined && title !== projectTitle;

  const handleSave = async () => {
    setError(null);

    const trimmedName = folderName.trim();
    if (folderChanged) {
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
        setError("Folder name must use only letters, numbers, underscore, and hyphen.");
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Rename on disk if folder or title changed
      let resolvedName = projectName;
      if (folderChanged || titleChanged) {
        const { name } = await renameProject(projectName, {
          ...(folderChanged ? { newName: trimmedName } : {}),
          ...(titleChanged ? { newTitle: title } : {}),
        });
        resolvedName = name;
        moveStoredProjectPath(projectName, resolvedName);
        onRenamed?.({
          newName: resolvedName,
          newTitle: titleChanged ? title : null,
        });
      }

      // 2. Persist local-path change (under the possibly-new name)
      if (showGitPath) {
        const trimmed = pathValue.trim();
        setStoredProjectPath(resolvedName, trimmed || null);
        onPathSaved?.();
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-5 z-50 w-[480px]">
        <h3 className="text-sm font-semibold text-zinc-200 mb-4">Project Settings</h3>

        {/* Rename section */}
        <label className="block text-xs text-zinc-400 mb-1">
          Folder name <span className="text-zinc-600">(on disk)</span>
        </label>
        <input
          type="text"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          className="w-full bg-zinc-800 text-zinc-200 rounded px-3 py-2 text-xs border border-zinc-700 focus:border-zinc-500 focus:outline-none font-mono"
          autoFocus
        />
        <p className="text-[10px] text-zinc-600 mt-1">
          Letters, numbers, underscore, hyphen only.
        </p>

        {projectTitle !== undefined && (
          <>
            <label className="block text-xs text-zinc-400 mt-3 mb-1">
              Display title <span className="text-zinc-600">(shown in the editor)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-800 text-zinc-200 rounded px-3 py-2 text-xs border border-zinc-700 focus:border-zinc-500 focus:outline-none"
            />
          </>
        )}

        {showGitPath && (
          <>
            <div className="h-px bg-zinc-800 my-4" />
            <label className="block text-xs text-zinc-400 mb-1">
              Local path <span className="text-zinc-600">(for git diff — optional)</span>
            </label>
            <input
              type="text"
              value={pathValue}
              onChange={(e) => setPathValue(e.target.value)}
              placeholder="e.g. /Users/me/projects/my-deck"
              className="w-full bg-zinc-800 text-zinc-200 rounded px-3 py-2 text-xs border border-zinc-700 focus:border-zinc-500 focus:outline-none font-mono"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
            <p className="text-[10px] text-zinc-600 mt-1">
              Absolute path to this project folder. Used to show uncommitted git changes.
            </p>
          </>
        )}

        {error && (
          <p className="text-xs text-red-400 mt-3">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
