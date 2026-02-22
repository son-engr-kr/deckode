import type { Deck } from "@/types/deck";
import type { FileSystemAdapter, ProjectInfo } from "./types";
import { saveHandle, clearHandle } from "@/utils/handleStore";

export class FsAccessAdapter implements FileSystemAdapter {
  readonly mode = "fs-access" as const;
  private dirHandle: FileSystemDirectoryHandle;
  private blobUrlCache = new Map<string, string>();
  readonly projectName: string;

  constructor(dirHandle: FileSystemDirectoryHandle) {
    this.dirHandle = dirHandle;
    this.projectName = dirHandle.name;
  }

  static async openDirectory(): Promise<FsAccessAdapter> {
    // showDirectoryPicker is part of the File System Access API (Chrome/Edge)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const showDirectoryPicker = (window as any).showDirectoryPicker as (
      options?: { mode?: "read" | "readwrite" },
    ) => Promise<FileSystemDirectoryHandle>;
    const dirHandle = await showDirectoryPicker({ mode: "readwrite" });
    await saveHandle(dirHandle);
    return new FsAccessAdapter(dirHandle);
  }

  static fromHandle(dirHandle: FileSystemDirectoryHandle): FsAccessAdapter {
    return new FsAccessAdapter(dirHandle);
  }

  /** Remove the persisted handle (call when user explicitly closes project). */
  static forget(): Promise<void> {
    return clearHandle();
  }

  async loadDeck(): Promise<Deck> {
    const fileHandle = await this.dirHandle.getFileHandle("deck.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as Deck;
  }

  async saveDeck(deck: Deck): Promise<void> {
    const fileHandle = await this.dirHandle.getFileHandle("deck.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(deck, null, 2));
    await writable.close();
  }

  async listProjects(): Promise<ProjectInfo[]> {
    // Single project = the opened directory
    const deck = await this.loadDeck();
    return [{ name: this.projectName, title: deck.meta.title }];
  }

  async createProject(_name: string, _title?: string): Promise<void> {
    throw new Error("Creating projects is not supported in File System Access mode. Open a different folder instead.");
  }

  async deleteProject(_name: string): Promise<void> {
    throw new Error("Deleting projects is not supported in File System Access mode.");
  }

  async uploadAsset(file: File): Promise<string> {
    const assetsDir = await this.dirHandle.getDirectoryHandle("assets", { create: true });

    // Deduplicate filename
    let name = file.name;
    let counter = 1;
    while (true) {
      try {
        await assetsDir.getFileHandle(name);
        // File exists, generate a new name
        const dot = file.name.lastIndexOf(".");
        const base = dot === -1 ? file.name : file.name.slice(0, dot);
        const ext = dot === -1 ? "" : file.name.slice(dot);
        name = `${base}-${counter}${ext}`;
        counter++;
      } catch {
        // File doesn't exist, use this name
        break;
      }
    }

    const fileHandle = await assetsDir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    const storedPath = `./assets/${name}`;
    // Pre-cache the blob URL
    const blob = new Blob([file], { type: file.type });
    const blobUrl = URL.createObjectURL(blob);
    this.blobUrlCache.set(storedPath, blobUrl);

    return storedPath;
  }

  async resolveAssetUrl(path: string): Promise<string> {
    const cached = this.blobUrlCache.get(path);
    if (cached) return cached;

    // Strip query string (dev server adds ?v=timestamp as cache-buster)
    const qIdx = path.indexOf("?");
    const cleanPath = qIdx === -1 ? path : path.slice(0, qIdx);

    // Support both new (./assets/...) and legacy (/assets/{project}/...) formats
    let subParts: string[];
    if (cleanPath.startsWith("./")) {
      // New format: ./assets/subdir/filename
      const parts = cleanPath.slice(2).split("/");
      assert(parts.length >= 2 && parts[0] === "assets", `Invalid asset path: ${path}`);
      subParts = parts.slice(1); // everything after "assets"
    } else {
      // Legacy format: /assets/{project}/subdir/filename
      const parts = cleanPath.replace(/^\//, "").split("/");
      assert(parts.length >= 3, `Invalid asset path: ${path}`);
      subParts = parts.slice(2); // everything after "assets/{projectName}"
    }
    const fileName = subParts.pop()!;
    assert(fileName.length > 0, `Empty filename in asset path: ${path}`);

    // Strip invisible Unicode characters that the FS Access API rejects
    // (e.g. U+200B zero-width space embedded in filenames from browser downloads)
    const stripInvisible = (s: string) => s.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "");

    let dir = await this.dirHandle.getDirectoryHandle("assets");
    for (const sub of subParts) {
      dir = await dir.getDirectoryHandle(stripInvisible(sub));
    }

    const sanitizedName = stripInvisible(fileName);

    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await dir.getFileHandle(sanitizedName);
    } catch {
      // File not found — it may have been uploaded in dev mode and doesn't
      // exist in this directory. Re-throw with context.
      throw new Error(
        `[FsAccessAdapter] Asset not found: "${sanitizedName}" (path: "${path}"). ` +
        `The file may have been uploaded via the dev server and is not present in the opened folder.`
      );
    }
    const file = await fileHandle.getFile();
    const blobUrl = URL.createObjectURL(file);
    this.blobUrlCache.set(path, blobUrl);
    return blobUrl;
  }

  async listComponents(): Promise<string[]> {
    let componentsDir: FileSystemDirectoryHandle;
    try {
      componentsDir = await this.dirHandle.getDirectoryHandle("components");
    } catch {
      return [];
    }
    const names: string[] = [];
    for await (const [name, handle] of componentsDir as any) {
      if (handle.kind === "file" && /\.(tsx|jsx)$/.test(name)) {
        names.push(name.replace(/\.(tsx|jsx)$/, ""));
      }
    }
    return names;
  }

  async renderTikz(
    elementId: string,
    content: string,
    preamble?: string,
  ): Promise<{ ok: true; svgUrl: string } | { ok: false; error: string }> {
    const { renderTikzToSvg } = await import("@/utils/tikzjax");
    const svgMarkup = await renderTikzToSvg(content, preamble);

    // Write SVG to assets/tikz/{elementId}.svg
    const assetsDir = await this.dirHandle.getDirectoryHandle("assets", { create: true });
    const tikzDir = await assetsDir.getDirectoryHandle("tikz", { create: true });
    const fileHandle = await tikzDir.getFileHandle(`${elementId}.svg`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(svgMarkup);
    await writable.close();

    // Cache a blob URL for immediate display.
    // Append ?v=timestamp so useAssetUrl detects the change (same element ID
    // produces the same base path, so React's useEffect wouldn't re-fire).
    const basePath = `./assets/tikz/${elementId}.svg`;
    const storedPath = `${basePath}?v=${Date.now()}`;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
    const blobUrl = URL.createObjectURL(blob);
    this.blobUrlCache.set(storedPath, blobUrl);

    return { ok: true, svgUrl: storedPath };
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[FsAccessAdapter] ${message}`);
}
