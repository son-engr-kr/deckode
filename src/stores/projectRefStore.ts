import { create } from "zustand";
import {
  saveContextProject,
  listContextProjects,
  removeContextProject,
  type ContextProject,
} from "@/utils/handleStore";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "__pycache__", ".venv", ".next", ".cache"]);
const MAX_DEPTH = 3;
const MAX_FILE_SIZE = 100 * 1024; // 100 KB

interface ProjectRefState {
  registeredProjects: ContextProject[];
  loading: boolean;

  /** Load registered projects from IndexedDB (call once on init). */
  loadRegistered: () => Promise<void>;

  /** Open directory picker and register a new reference project. Returns name or null if cancelled. */
  registerProject: () => Promise<string | null>;

  /** Remove a registered project by name. */
  unregisterProject: (name: string) => Promise<void>;

  /** List files in a registered project directory. */
  listFiles: (projectName: string, path?: string) => Promise<string[]>;

  /** Read file content from a registered project. */
  readFile: (projectName: string, filePath: string) => Promise<string>;
}

/** Walk a directory handle recursively, returning relative paths. */
async function walkDirectory(
  handle: FileSystemDirectoryHandle,
  prefix: string,
  depth: number,
  results: string[],
): Promise<void> {
  if (depth > MAX_DEPTH) return;
  for await (const entry of (handle as any).values()) {
    const entryHandle = entry as FileSystemHandle;
    const relativePath = prefix ? `${prefix}/${entryHandle.name}` : entryHandle.name;
    if (entryHandle.kind === "file") {
      results.push(relativePath);
    } else if (entryHandle.kind === "directory") {
      if (SKIP_DIRS.has(entryHandle.name)) continue;
      results.push(relativePath + "/");
      await walkDirectory(entryHandle as FileSystemDirectoryHandle, relativePath, depth + 1, results);
    }
  }
}

/** Navigate to a subdirectory handle by path segments. */
async function navigateTo(
  root: FileSystemDirectoryHandle,
  pathSegments: string[],
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const segment of pathSegments) {
    dir = await dir.getDirectoryHandle(segment);
  }
  return dir;
}

export const useProjectRefStore = create<ProjectRefState>((set, get) => ({
  registeredProjects: [],
  loading: false,

  loadRegistered: async () => {
    set({ loading: true });
    const projects = await listContextProjects();
    // Re-verify permissions (may prompt user)
    const verified: ContextProject[] = [];
    for (const p of projects) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perm = await (p.handle as any).requestPermission({ mode: "read" });
        if (perm === "granted") verified.push(p);
      } catch {
        // Permission denied or handle invalid — skip
      }
    }
    set({ registeredProjects: verified, loading: false });
  },

  registerProject: async () => {
    try {
      const showDirectoryPicker = (window as any).showDirectoryPicker as (
        options?: { mode?: "read" | "readwrite" },
      ) => Promise<FileSystemDirectoryHandle>;
      const handle = await showDirectoryPicker({ mode: "read" });

      // Check for duplicate
      const existing = get().registeredProjects;
      if (existing.some((p) => p.name === handle.name)) {
        return handle.name; // already registered
      }

      const entry = await saveContextProject(handle);
      set({ registeredProjects: [...existing, entry] });
      return handle.name;
    } catch {
      return null; // user cancelled picker
    }
  },

  unregisterProject: async (name) => {
    await removeContextProject(name);
    set({ registeredProjects: get().registeredProjects.filter((p) => p.name !== name) });
  },

  listFiles: async (projectName, path) => {
    const project = get().registeredProjects.find((p) => p.name === projectName);
    if (!project) throw new Error(`Project "${projectName}" not registered`);

    let targetDir = project.handle;
    if (path) {
      const segments = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
      targetDir = await navigateTo(project.handle, segments);
    }

    const results: string[] = [];
    await walkDirectory(targetDir, path?.replace(/^\/+|\/+$/g, "") ?? "", 0, results);
    return results;
  },

  readFile: async (projectName, filePath) => {
    const project = get().registeredProjects.find((p) => p.name === projectName);
    if (!project) throw new Error(`Project "${projectName}" not registered`);

    const segments = filePath.replace(/^\/+/, "").split("/").filter(Boolean);
    const fileName = segments.pop();
    if (!fileName) throw new Error("Invalid file path");

    const dir = segments.length > 0
      ? await navigateTo(project.handle, segments)
      : project.handle;

    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large (${(file.size / 1024).toFixed(0)} KB > ${MAX_FILE_SIZE / 1024} KB limit)`);
    }
    return file.text();
  },
}));
