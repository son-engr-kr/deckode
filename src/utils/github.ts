import type { Deck } from "@/types/deck";
import { assert } from "@/utils/assert";

export interface GitHubSource {
  owner: string;
  repo: string;
  path: string;
  branch: string;
}

/**
 * Parses a GitHub param string like "owner/repo[/path][@branch]"
 * into a structured object.
 */
export function parseGitHubParam(param: string): GitHubSource {
  assert(param.length > 0, "GitHub param is empty");

  let branch = "main";
  let rest = param;

  // Extract @branch suffix
  const atIdx = rest.lastIndexOf("@");
  if (atIdx !== -1) {
    branch = rest.slice(atIdx + 1);
    rest = rest.slice(0, atIdx);
    assert(branch.length > 0, "GitHub param has empty branch after @");
  }

  const parts = rest.split("/");
  assert(parts.length >= 2, `GitHub param must be "owner/repo[/path][@branch]", got "${param}"`);

  const owner = parts[0]!;
  const repo = parts[1]!;
  const path = parts.length > 2 ? parts.slice(2).join("/") : "";

  return { owner, repo, path, branch };
}

/**
 * Builds the raw.githubusercontent.com base URL for a parsed GitHub source.
 */
export function buildGitHubRawBase(source: GitHubSource): string {
  const base = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.branch}`;
  return source.path ? `${base}/${source.path}` : base;
}

/**
 * Parses a full GitHub URL into a GitHubSource.
 * Accepts:
 *   - Full URL: https://github.com/owner/repo/tree/branch/path/to/folder
 *   - Short format: owner/repo/path@branch (delegates to parseGitHubParam)
 *
 * Returns null if the input cannot be parsed.
 */
export function parseGitHubUrl(input: string): GitHubSource | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // Try full GitHub URL
  const urlPattern = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/?(.*)$/;
  const match = trimmed.match(urlPattern);
  if (match) {
    const owner = match[1]!;
    const repo = match[2]!;
    const branch = match[3]!;
    const path = match[4]?.replace(/\/$/, "") ?? "";
    return { owner, repo, path, branch };
  }

  // Try short format (must have at least owner/repo)
  if (!trimmed.startsWith("http") && trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length >= 2 && parts[0]!.length > 0 && parts[1]!.length > 0) {
      return parseGitHubParam(trimmed);
    }
  }

  return null;
}

/**
 * Builds a Deckode URL from a GitHubSource.
 * Returns both editor and presentation URLs.
 */
export function buildDeckodeUrls(
  origin: string,
  pathname: string,
  source: GitHubSource,
): { editor: string; present: string } {
  const branchSuffix = source.branch !== "main" ? `@${source.branch}` : "";
  const ghParam = source.path
    ? `${source.owner}/${source.repo}/${source.path}${branchSuffix}`
    : `${source.owner}/${source.repo}${branchSuffix}`;
  const base = `${origin}${pathname}`;
  return {
    editor: `${base}?gh=${ghParam}`,
    present: `${base}?gh=${ghParam}&mode=present`,
  };
}

/**
 * Fetches deck.json from a GitHub repo and returns it as a Deck.
 */
export async function fetchGitHubDeck(source: GitHubSource): Promise<Deck> {
  const rawBase = buildGitHubRawBase(source);
  const url = `${rawBase}/deck.json`;

  const res = await fetch(url);
  assert(res.ok, `Failed to fetch deck.json from GitHub: ${res.status} ${res.statusText} (${url})`);

  const deck = (await res.json()) as Deck;
  assert(deck.slides !== undefined && Array.isArray(deck.slides), "Fetched JSON is not a valid Deck (missing slides array)");

  // Resolve $ref entries by fetching referenced files from the same repo
  for (let i = 0; i < deck.slides.length; i++) {
    const entry = deck.slides[i] as any;
    if (entry.$ref && typeof entry.$ref === "string") {
      const refUrl = `${rawBase}/${entry.$ref.replace("./", "")}`;
      const refRes = await fetch(refUrl);
      if (refRes.ok) {
        const slide = await refRes.json();
        slide._ref = entry.$ref;
        deck.slides[i] = slide;
      }
    }
  }

  return deck;
}
