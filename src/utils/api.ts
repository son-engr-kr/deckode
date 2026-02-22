import type { Deck } from "@/types/deck";
import type { ProjectInfo } from "@/adapters/types";

export type { ProjectInfo };

export async function listProjects(): Promise<ProjectInfo[]> {
  const res = await fetch("/api/projects");
  assert(res.ok, `Failed to list projects: ${res.status}`);
  const data = await res.json();
  return data.projects;
}

export async function createProject(name: string, title?: string): Promise<void> {
  const res = await fetch("/api/create-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, title }),
  });
  assert(res.ok, `Failed to create project: ${res.status}`);
}

export async function deleteProject(name: string): Promise<void> {
  const res = await fetch("/api/delete-project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  assert(res.ok, `Failed to delete project: ${res.status}`);
}

export async function loadDeckFromDisk(project: string): Promise<Deck | null> {
  const res = await fetch(`/api/load-deck?project=${encodeURIComponent(project)}`);
  if (!res.ok) return null;
  return res.json() as Promise<Deck>;
}

export async function saveDeckToDisk(deck: Deck, project: string): Promise<void> {
  const res = await fetch(`/api/save-deck?project=${encodeURIComponent(project)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(deck, null, 2),
  });
  assert(res.ok, `Failed to save deck: ${res.status}`);
}

export async function uploadAsset(file: File, project: string): Promise<string> {
  const res = await fetch(`/api/upload-asset?project=${encodeURIComponent(project)}`, {
    method: "POST",
    headers: {
      "Content-Type": file.type,
      "X-Filename": encodeURIComponent(file.name),
    },
    body: file,
  });
  assert(res.ok, `Failed to upload asset: ${res.status}`);
  const data = await res.json();
  return data.url;
}

export async function renderTikz(
  project: string,
  elementId: string,
  content: string,
  preamble?: string,
): Promise<{ ok: true; svgUrl: string } | { ok: false; error: string }> {
  const res = await fetch(`/api/render-tikz?project=${encodeURIComponent(project)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ elementId, content, preamble }),
  });
  assert(res.ok, `Failed to render TikZ: ${res.status}`);
  return res.json();
}

export async function listComponents(project: string): Promise<string[]> {
  const res = await fetch(`/api/list-components?project=${encodeURIComponent(project)}`);
  assert(res.ok, `Failed to list components: ${res.status}`);
  const data = await res.json();
  return data.components;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[API] ${message}`);
}
