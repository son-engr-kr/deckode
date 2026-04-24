/**
 * Registry of the demo decks bundled with TEKKAL. The landing page
 * renders a gallery from this list, and `?demo=<id>` URL routing
 * resolves to the matching entry's deckLoader.
 *
 * Each deck lives at `templates/demos/<id>/deck.json` and is lazy-loaded
 * via dynamic import so the landing page bundle stays small — tiles show
 * only the first slide, which is available after the single import fires.
 */

import type { Deck } from "@/types/deck";
import { normalizeDeckLegacyFields } from "@/types/deck";

export type DemoCategory = "Product" | "Economics" | "Accounting" | "Physics" | "CV";

export interface DemoEntry {
  id: string;
  title: string;
  subtitle: string;
  category: DemoCategory;
  loadDeck: () => Promise<Deck>;
}

function wrap(importer: () => Promise<{ default: unknown }>): () => Promise<Deck> {
  return async () => {
    const mod = await importer();
    return normalizeDeckLegacyFields(mod.default as Deck);
  };
}

export const DEMO_CATALOG: DemoEntry[] = [
  {
    id: "tekkal-intro",
    title: "TEKKAL",
    subtitle: "Local-first, AI-agent-driven slide platform",
    category: "Product",
    loadDeck: wrap(() => import("../../templates/demos/tekkal-intro/deck.json")),
  },
  {
    id: "economics",
    title: "Macroeconomics 101",
    subtitle: "GDP, inflation, and the Phillips curve",
    category: "Economics",
    loadDeck: wrap(() => import("../../templates/demos/economics/deck.json")),
  },
  {
    id: "accounting",
    title: "Double-Entry Accounting",
    subtitle: "The fundamental equation and journal entries",
    category: "Accounting",
    loadDeck: wrap(() => import("../../templates/demos/accounting/deck.json")),
  },
  {
    id: "physics",
    title: "Quantum Mechanics",
    subtitle: "Wave–particle duality and the Schrödinger equation",
    category: "Physics",
    loadDeck: wrap(() => import("../../templates/demos/physics/deck.json")),
  },
  {
    id: "cv",
    title: "Mina Seo",
    subtitle: "Curriculum vitae · quantitative researcher",
    category: "CV",
    loadDeck: wrap(() => import("../../templates/demos/cv/deck.json")),
  },
];

export function getDemoById(id: string): DemoEntry | undefined {
  return DEMO_CATALOG.find((d) => d.id === id);
}

/** Back-compat: bare `?demo` (no id) maps to the product intro. */
export const DEFAULT_DEMO_ID = "tekkal-intro";
