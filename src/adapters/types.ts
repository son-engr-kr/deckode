import type { Deck } from "@/types/deck";

export interface ProjectInfo {
  name: string;
  title: string;
}

export interface TikzResult {
  ok: boolean;
  svgUrl?: string;
  error?: string;
}

export interface FileSystemAdapter {
  loadDeck(): Promise<Deck>;
  saveDeck(deck: Deck): Promise<void>;
  listProjects(): Promise<ProjectInfo[]>;
  createProject(name: string, title?: string): Promise<void>;
  deleteProject(name: string): Promise<void>;
  uploadAsset(file: File): Promise<string>;
  resolveAssetUrl(path: string): string | Promise<string>;
  renderTikz(
    elementId: string,
    content: string,
    preamble?: string,
  ): Promise<{ ok: true; svgUrl: string } | { ok: false; error: string }>;
  listComponents(): Promise<string[]>;
  readonly mode: "vite" | "fs-access";
  readonly projectName: string;
}
