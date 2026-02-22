import type { Deck, DeckTheme } from "@/types/deck";

// ----- Types -----

export type TemplateKind = "blank" | "example" | "wizard";

export interface WizardConfig {
  title: string;
  author?: string;
  aspectRatio: "16:9" | "4:3";
  theme: "dark" | "light";
  slideCount: number;
}

export interface NewProjectConfig {
  template: TemplateKind;
  name?: string;
  title?: string;
  wizard?: WizardConfig;
}

// ----- Theme Presets -----

export const DARK_THEME: DeckTheme = {
  slide: { background: { color: "#0f172a" } },
  text: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 24, color: "#ffffff" },
  code: { theme: "github-dark", fontSize: 16 },
  shape: { stroke: "#ffffff", strokeWidth: 1 },
  image: { objectFit: "contain" },
  video: { objectFit: "contain" },
  tikz: { backgroundColor: "#1e1e2e" },
};

export const LIGHT_THEME: DeckTheme = {
  slide: { background: { color: "#ffffff" } },
  text: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 24, color: "#1e293b" },
  code: { theme: "github-light", fontSize: 16 },
  shape: { stroke: "#334155", strokeWidth: 1 },
  image: { objectFit: "contain" },
  video: { objectFit: "contain" },
  tikz: { backgroundColor: "#f8fafc" },
};

// ----- Generators -----

export function generateBlankDeck(title?: string): Deck {
  return {
    deckode: "0.1.0",
    meta: {
      title: title || "Untitled Presentation",
      aspectRatio: "16:9",
    },
    theme: { ...DARK_THEME },
    slides: [
      {
        id: "s1",
        background: { color: "#0f172a" },
        elements: [],
      },
    ],
  };
}

export function generateWizardDeck(config: WizardConfig): Deck {
  const theme = config.theme === "light" ? LIGHT_THEME : DARK_THEME;
  const bgColor = theme.slide?.background?.color ?? "#0f172a";
  const titleColor = config.theme === "light" ? "#0f172a" : "#f8fafc";
  const subtitleColor = config.theme === "light" ? "#64748b" : "#94a3b8";

  const slides = Array.from({ length: config.slideCount }, (_, i) => {
    const slideNum = i + 1;
    if (slideNum === 1) {
      // Title slide
      return {
        id: `s${slideNum}`,
        background: { color: bgColor },
        elements: [
          {
            id: "title",
            type: "text" as const,
            content: `# ${config.title}`,
            position: { x: 80, y: 180 },
            size: { w: 800, h: 120 },
            style: { fontSize: 48, color: titleColor, textAlign: "center" as const, verticalAlign: "middle" as const },
          },
          ...(config.author
            ? [
                {
                  id: "author",
                  type: "text" as const,
                  content: config.author,
                  position: { x: 280, y: 320 },
                  size: { w: 400, h: 40 },
                  style: { fontSize: 20, color: subtitleColor, textAlign: "center" as const },
                },
              ]
            : []),
        ],
      };
    }
    // Content slides
    return {
      id: `s${slideNum}`,
      background: { color: bgColor },
      elements: [
        {
          id: "heading",
          type: "text" as const,
          content: `## Slide ${slideNum}`,
          position: { x: 60, y: 40 },
          size: { w: 840, h: 60 },
          style: { fontSize: 36, color: titleColor },
        },
      ],
    };
  });

  return {
    deckode: "0.1.0",
    meta: {
      title: config.title,
      author: config.author || undefined,
      aspectRatio: config.aspectRatio,
    },
    theme: { ...theme },
    slides,
  };
}
