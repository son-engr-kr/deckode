import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { useAdapter } from "@/contexts/AdapterContext";
import { loadGitBaseDeck, fetchGitHeadHash } from "@/utils/api";
import { getStoredProjectPath } from "@/components/editor/ProjectSettingsDialog";
import { diffSlides } from "@/utils/deckDiff";
import type { Deck, Slide } from "@/types/deck";
import type { ChangeType } from "@/utils/deckDiff";

export interface GitDiffResult {
  changedSlideIds: Set<string>;
  elementChanges: Map<string, ChangeType>;
  baseNotes: string | undefined;
  baseComments: any[] | undefined;
  available: boolean;
  unavailableReason?: "no-path" | "no-git";
  refetch: () => void;
}

const EMPTY_SLIDES = new Set<string>();
const EMPTY_ELEMENTS = new Map<string, ChangeType>();
const POLL_INTERVAL = 30_000;
const CACHE_PREFIX = "tekkal-git-base:";

// WeakMap cache: avoids re-serializing unchanged slide objects (immer structural sharing)
const slideHashCache = new WeakMap<object, string>();

function getSlideHash(slide: Slide): string {
  let hash = slideHashCache.get(slide);
  if (hash !== undefined) return hash;
  const { _ref: _, ...rest } = slide as any;
  hash = JSON.stringify(rest);
  slideHashCache.set(slide, hash);
  return hash;
}

function getCachedBase(project: string, hash: string): Deck | null {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${project}`);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.hash === hash) return cached.deck;
  } catch { /* ignore */ }
  return null;
}

function setCachedBase(project: string, hash: string, deck: Deck) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${project}`, JSON.stringify({ hash, deck }));
  } catch { /* storage full */ }
}

const DEFAULT_RESULT: GitDiffResult = {
  changedSlideIds: EMPTY_SLIDES,
  elementChanges: EMPTY_ELEMENTS,
  baseNotes: undefined,
  baseComments: undefined,
  available: false,
  refetch: () => {},
};

const GitDiffContext = createContext<GitDiffResult>(DEFAULT_RESULT);

export function useGitDiff(): GitDiffResult {
  return useContext(GitDiffContext);
}

const DIFF_DEBOUNCE_MS = 500;

export function GitDiffProvider({ children }: { children: ReactNode }) {
  const slides = useDeckStore((s) => s.deck?.slides);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);

  // Debounce slides to avoid recomputing diff on every keystroke/drag frame
  const [debouncedSlides, setDebouncedSlides] = useState(slides);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlides(slides), DIFF_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [slides]);
  const adapter = useAdapter();
  const [baseDeck, setBaseDeck] = useState<Deck | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<"no-path" | "no-git" | undefined>();
  const [fetchVersion, setFetchVersion] = useState(0);
  const headHashRef = useRef<string | null>(null);
  const fetchedKey = useRef<string | null>(null);

  // Pre-compute base slide hashes once when baseDeck changes
  const baseSlideHashMap = useMemo(() => {
    if (!baseDeck) return null;
    const map = new Map<string, string>();
    for (const s of baseDeck.slides) {
      map.set(s.id, getSlideHash(s));
    }
    return map;
  }, [baseDeck]);

  const refetch = useCallback(() => {
    fetchedKey.current = null;
    headHashRef.current = null;
    setFetchVersion((v) => v + 1);
  }, []);

  // Fetch git base with caching
  useEffect(() => {
    const project = adapter.projectName;
    const absPath = adapter.mode === "fs-access"
      ? getStoredProjectPath(project) ?? undefined
      : undefined;

    const key = `${project}:${absPath ?? ""}:${fetchVersion}`;
    if (fetchedKey.current === key) return;
    fetchedKey.current = key;

    if (adapter.mode === "fs-access" && !absPath) {
      setUnavailableReason("no-path");
      setBaseDeck(null);
      return;
    }

    // Read-only adapters (bundled demos, GitHub-hosted decks) have no git
    // backend. Skip the fetch so we don't 404 against a non-existent API.
    if (adapter.mode === "readonly") {
      setUnavailableReason("no-git");
      setBaseDeck(null);
      return;
    }

    fetchGitHeadHash(project, absPath).then((hash) => {
      if (!hash) {
        setUnavailableReason("no-git");
        setBaseDeck(null);
        return;
      }
      headHashRef.current = hash;

      const cached = getCachedBase(project, hash);
      if (cached) {
        setBaseDeck(cached);
        setUnavailableReason(undefined);
        return;
      }

      loadGitBaseDeck(project, absPath).then((base) => {
        if (base) {
          setCachedBase(project, hash, base);
          setBaseDeck(base);
          setUnavailableReason(undefined);
        } else {
          setUnavailableReason("no-git");
          setBaseDeck(null);
        }
      });
    });
  }, [adapter.projectName, adapter.mode, fetchVersion]);

  // Poll for HEAD hash changes
  useEffect(() => {
    if (unavailableReason) return;

    const project = adapter.projectName;
    const absPath = adapter.mode === "fs-access"
      ? getStoredProjectPath(project) ?? undefined
      : undefined;

    if (adapter.mode === "fs-access" && !absPath) return;

    const interval = setInterval(async () => {
      const hash = await fetchGitHeadHash(project, absPath);
      if (hash && headHashRef.current && hash !== headHashRef.current) {
        refetch();
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [adapter.projectName, adapter.mode, unavailableReason, refetch]);

  const value = useMemo((): GitDiffResult => {
    const base = { refetch, unavailableReason };

    if (unavailableReason || !baseDeck || !debouncedSlides || !baseSlideHashMap) {
      return {
        changedSlideIds: EMPTY_SLIDES,
        elementChanges: EMPTY_ELEMENTS,
        baseNotes: undefined,
        baseComments: undefined,
        available: false,
        ...base,
      };
    }

    const changedSlideIds = new Set<string>();
    for (const slide of debouncedSlides) {
      const baseHash = baseSlideHashMap.get(slide.id);
      if (!baseHash) {
        changedSlideIds.add(slide.id);
      } else if (getSlideHash(slide) !== baseHash) {
        changedSlideIds.add(slide.id);
      }
    }

    const elementChanges = new Map<string, ChangeType>();
    const currentSlide = debouncedSlides[currentSlideIndex];
    const baseSlideMap = new Map(baseDeck.slides.map((s) => [s.id, s]));

    if (currentSlide) {
      const baseSlide = baseSlideMap.get(currentSlide.id) ?? null;
      const diff = diffSlides(baseSlide, currentSlide);
      if (diff) {
        for (const ed of diff.elements) {
          if (ed.change !== "unchanged") {
            elementChanges.set(ed.elementId, ed.change);
          }
        }
      }
    }

    const baseSlideForCurrent = currentSlide ? baseSlideMap.get(currentSlide.id) : undefined;
    const baseNotes = baseSlideForCurrent?.notes;
    const baseComments = baseSlideForCurrent?.comments;

    return {
      changedSlideIds,
      elementChanges,
      baseNotes,
      baseComments,
      available: true,
      ...base,
    };
  }, [unavailableReason, baseDeck, debouncedSlides, currentSlideIndex, baseSlideHashMap, refetch]);

  return (
    <GitDiffContext.Provider value={value}>
      {children}
    </GitDiffContext.Provider>
  );
}
