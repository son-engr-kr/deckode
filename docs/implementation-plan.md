# Deckode Implementation Plan

## Mission & Problem

**Problem:** Existing tools are either too restrictive/vendor-locked (Gamma), too complex for non-developers (Slidev/LaTeX), or produce low-quality output from PPTX-based automation with limited web-native capabilities.

**Mission:** Build an **open-source, AI-first slide platform** that combines block-editor simplicity th developer-stack power (React, LaTeX, Tailwind).

**Target Users:** STEM researchers, engineers, and high-end agency designers who need both precision and aesthetics.

**Revenue Model (Open Core):** Free open-source engine + paid SaaS layer for hosting, AI credits, and enterprise collaboration tools.

---

## Overview

Deckode is a local-first, AI-agent-driven slide platform. The core idea: slides are a JSON scene graph (`deck.json`), rendered by React components, and editable via both a visual drag-and-drop editor and a code editor. An AI agent can generate and modify `deck.json` directly.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser UI                     │
│  ┌──────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Visual Editor │  │  Code View │  │ Presenter│ │
│  │ (drag/resize) │  │  (Monaco)  │  │   Mode   │ │
│  └──────┬───────┘  └─────┬──────┘  └────┬─────┘ │
│         │                │               │       │
│         ▼                ▼               │       │
│  ┌──────────────────────────────┐        │       │
│  │     Zustand Store (deck)     │◄───────┘       │
│  │   Source of truth: deck.json │                 │
│  └──────────────┬───────────────┘                 │
│                 │                                  │
│                 ▼                                  │
│  ┌──────────────────────────────┐                 │
│  │      Slide Renderer          │                 │
│  │  (React component per type)  │                 │
│  └──────────────────────────────┘                 │
└─────────────────────────────────────────────────┘
```

### Data Flow

1. `deck.json` is loaded into Zustand store on startup
2. Visual Editor reads from store, renders interactive canvas
3. User drags/resizes element → store updates `position`/`size`
4. Monaco Editor displays store state as formatted JSON
5. Edits in Monaco → parse JSON → update store
6. Slide Renderer subscribes to store, re-renders on changes

---

## Phase 0: Skeleton (Current)

### Goals

- [X] Vite + React + TypeScript project initialized
- [X] Tailwind CSS v4 configured
- [X] Directory structure created
- [X] Core TypeScript types defined (`Deck`, `Slide`, `Element`, etc.)
- [X] JSON Schema for `deck.json` validation
- [X] Sample `deck.json` with diverse element types
- [X] Basic `SlideRenderer` that reads JSON and renders to screen

### Deliverable

Run `npm run dev`, see a rendered slide from `deck.json`.

---

## Phase 1: Core Renderer

### Goals

- [X] Element renderers: `TextElement`, `ImageElement`, `CodeElement`, `ShapeElement`
- [X] Markdown rendering in text elements (inline formatting: bold, italic, links)
- [X] KaTeX math rendering (`$inline$` and `$$block$$`)
- [X] Code syntax highlighting via Shiki
- [X] Slide navigation (arrow keys, click)
- [X] Slide transition animations (fade, slide) via Framer Motion
- [X] Basic theme system (ThemeContext, ThemePanel, per-element-type defaults)
- [X] Aspect ratio enforcement (16:9 / 4:3)
- [X] File persistence: Vite plugin API (`/api/save-deck`, `/api/load-deck`), auto-save on change, Ctrl+S
- [X] Fullscreen presentation mode (F5 to enter, Escape to exit, arrow keys nav)

### Key Decisions

- Slide coordinate system: **960x540 virtual canvas** (16:9), scaled to fit viewport. All `position` and `size` values are in this virtual space.
- Text content uses Markdown. Renderer parses Markdown to React elements.
- File persistence via a custom Vite plugin that exposes `POST /api/save-deck` to write `deck.json`. This keeps the project local-first with no separate backend.

---

## Phase 2: Visual Editor

### Goals

- [X] Editor layout: sidebar (slide list) + canvas (current slide) + properties panel
- [X] Canvas renders current slide with interactive element overlays
- [X] Drag elements to reposition, update `position` in store
- [X] Selection handles on selected elements
- [X] Property panel: edit selected element's position, size, content
- [X] Monaco Editor panel: view/edit full `deck.json`, bidirectional sync with store
- [X] Add/delete slides (sidebar + button, hover delete)
- [X] Add/delete elements (toolbar palette: text, image, shape, code)
- [X] Undo/redo (zundo temporal middleware, Ctrl+Z / Ctrl+Shift+Z, toolbar buttons)
  - [X] Smart undo/redo: auto-navigate to affected slide, highlight changed elements, drag-safe debounce
- [X] Keyboard shortcuts (Delete/Backspace, Ctrl+Z, Ctrl+Shift+Z, Ctrl+S, F5)
- [X] Slide reordering via drag-and-drop in sidebar (@dnd-kit/sortable)
- [X] Element resize handles (drag corners to resize, update `size` in store)
- [X] Element duplicate (Ctrl+D)
- [ ] Resizable panels: left sidebar and right panel width adjustable by dragging dividers
- [ ] Custom scrollbar styling: thin, minimal scrollbar matching the dark theme

### Key Decisions

- Editor canvas and presentation renderer share the same `SlideRenderer` component. Editor adds an overlay layer for selection/drag handles.
- All edits go through Zustand actions. No direct DOM manipulation.

---

## Phase 2.5: Multi-Project Support

### Goals

- [X] Support multiple projects inside the `projects/` directory (e.g., `projects/my-slides/`, `projects/conference-talk/`)
- [X] Each sub-project contains its own `deck.json` and `assets/` folder
- [X] Project selector UI to switch between projects
- [X] API endpoints accept a `?project=name` parameter to load/save the correct project
- [X] Creating a new project initializes a fresh sub-directory from `templates/default/deck.json`
- [X] Legacy migration: flat `projects/deck.json` auto-migrated to `projects/default/`
- [X] Asset URLs rewritten during migration (`/assets/foo` → `/assets/default/foo`)
- [X] URL sync: `?project=name` in browser URL auto-opens the project on refresh

### Key Decisions

- The `projects/` directory becomes a workspace containing multiple independent presentations.
- Each sub-project is fully portable — copy a sub-directory to move a presentation.
- Structure: `projects/{name}/deck.json` and `projects/{name}/assets/`
- Asset URL scheme: `./assets/{filename}` (project-relative, resolved to `/assets/{project}/{filename}` at runtime)

---

## Phase 3: Asset Management & Drag-and-Drop

### Goals

- [X] Asset directory: project-level `assets/` folder for images, videos, and other media
- [X] Vite plugin API endpoint: `POST /api/upload-asset` — receives a file, saves it to `assets/` (or a user-specified subdirectory), returns the relative path
- [X] Vite static serving: serve `assets/` so relative paths like `assets/photo.png` resolve in the browser
- [X] Drag-and-drop on editor canvas: drop image/video files onto the slide → auto-upload to `assets/` → create an image or video element with the relative path as `src`
- [X] Default behavior: dropping a file saves it to `assets/` root with its original filename (deduplication via suffix if name collides)
- [X] Relative path resolution: all `src` fields in image/video elements use relative paths (e.g., `assets/diagrams/figure1.png`) so the project is portable
- [X] Property panel: `src` field shows the relative path; user can manually edit to point to any path within the project

### Key Decisions

- Files are **copied** into the project (not symlinked), so the project folder is self-contained and portable.
- The `assets/` folder has no enforced internal structure — users can organize subdirectories freely.
- The upload endpoint only accepts files within a size limit (e.g., 50 MB) and common media MIME types.
- Video files dropped onto the canvas create a `video` element; image files create an `image` element. Detection is by MIME type.

---

## Phase 4: Polish & Export

### Goals

- [X] Framer Motion animations (per-element enter/exit animations)
- [X] Animation editor UI in Property Panel: add/remove/edit animations per element (effect, trigger, delay, duration) without touching JSON
- [X] Slide-wide animation list panel with reorder, target element selector
- [X] Extended animation triggers: `onKey` (specific keypress advances/triggers animation), `afterPrevious` (auto-chain after the previous animation completes), `withPrevious` (play simultaneously with previous animation)
- [X] Animation preview in editor: play button in Property Panel to preview selected element's animation without entering presentation mode
- [X] Presenter mode with BroadcastChannel (main window + presenter notes window)
- [X] Custom component loading from `components/` directory
- [X] Layout templates (`layouts/` directory, reusable slide structures)
- [X] Fix: F5 fullscreen presentation mode regression (F5 should enter fullscreen, currently requires F11)
- [X] Fix: ellipse shape stroke clipping (inset radii by half stroke width)
- [X] Presenter view (PowerPoint-style): dual-screen support with slide display on one screen and presenter console on another
  - [X] Presenter console: current slide preview, next slide preview, elapsed timer, presenter notes
  - [X] Presenter notes editor: per-slide script/notes editable in the editor's property panel
  - [X] Animation-aware script highlighting: notes highlight the relevant section as animations progress (marker-based, e.g. `[step:1]...[/step]` tags in notes so users can easily edit the mapping)
  - [X] Zoom/screen-share friendly: presenter console works as a separate window, so users can share only the slide window
  - [X] Laser pointer overlay on presentation slide (toggle with L key, synced via BroadcastChannel)
- [ ] PDF export via browser print API (window.print() with @media print CSS, no server dependency)
- [ ] PPTX export (client-side via pptxgenjs, no server dependency)
- [ ] CLI: `npx deckode dev` (local development only)

---

## Phase 5: Advanced Rendering

### Goals

- [X] TikZ/PGFPlots rendering: WASM TeX engine (TikZJax) with TikZ editor UI (live preview, preamble, error display)
- [ ] WASM TeX caching optimization (IndexedDB SVG cache, compilation result memoization for repeated renders)
- [ ] Text-to-TikZ PoC: AI generates/modifies TikZ code from user feedback, rendered as slide element (client-side AI API call + WASM rendering)

### Key Decisions

- Simple math: KaTeX (client-side, already implemented in Phase 1).
- Complex diagrams (TikZ/PGFPlots): WASM-based TeX engine (TikZJax) running entirely in the browser. No server dependency.
- TikZ output is embedded as SVG in a new `tikz` element type in `deck.json`.

---

## Phase 5.5: File System Access API Migration

### Goals

- [X] Abstract file I/O behind an adapter interface (`FileSystemAdapter`)
- [X] Implement `FsAccessAdapter` using the File System Access API (`showDirectoryPicker`, `FileSystemFileHandle`, `FileSystemDirectoryHandle`)
- [X] Replace Vite plugin API endpoints (`/api/save-deck`, `/api/load-deck`, `/api/upload-asset`) with adapter calls
- [X] Project open flow: user picks a local folder via OS directory picker → app reads `deck.json` and assets directly
- [X] Persist directory handle across page reloads (IndexedDB) to avoid re-prompting
- [X] WASM TeX engine for TikZ rendering (eliminate server-side LaTeX dependency, enable fully client-side operation)
- [ ] Static deployment to GitHub Pages — zero backend, fully browser-native

### Key Decisions

- File System Access API is Chrome/Edge only. Firefox/Safari users will need a polyfill or fallback (future consideration).
- Vite remains as dev server for HMR during development, but no longer handles file I/O.
- With WASM TeX + File System Access API, the app becomes fully self-contained in the browser.
- **Zero-server architecture**: The production build is a static SPA deployable to GitHub Pages. All features (rendering, file I/O, TikZ compilation, exports) run entirely client-side.

---

## Phase 6: AI Agent Integration

### Track A: External AI Tools (primary)

- [X] Define a "tool" interface for AI: `createDeck`, `addSlide`, `updateElement`, `deleteElement`
- [X] JSON Schema serves as the contract between AI and Deckode
- [X] Validate AI output against schema before applying
- [ ] MCP server: expose Deckode tools via Model Context Protocol so AI agents (Claude Desktop, etc.) can manipulate `deck.json` directly
- [ ] Comprehensive `ai-slide-guide.md`: full specification with examples for every element type, animation, and layout

### Track B: In-App AI Chat — ON HOLD

> **Deferred**: Requires API keys and further design discussion. Do not implement unless explicitly requested.

- [ ] API key management UI (BYOK, stored in IndexedDB)
- [ ] In-app chat panel (natural language → deck.json generation)
- [ ] AI guardrails (validate AI-generated code before rendering)
- [ ] AI natural language → animation mapping

### Key Decisions

- AI integration is through `deck.json` manipulation. The AI does not need to know about React components or internal rendering. It only needs to produce valid `deck.json`.
- See `docs/ai-slide-guide.md` for the full AI-facing specification.
- **External tools are first-class citizens**: Claude Code, Cursor, or any tool that reads the guide and schema can generate valid decks without any integration work.

---

## File Responsibilities

| File/Directory                                | Responsibility                     |
| --------------------------------------------- | ---------------------------------- |
| `src/types/deck.ts`                         | TypeScript types for deck.json     |
| `src/schema/deck.schema.json`               | JSON Schema for validation         |
| `src/stores/deckStore.ts`                   | Zustand store: deck state, actions |
| `src/components/renderer/SlideRenderer.tsx` | Renders a single slide from data   |
| `src/components/renderer/elements/`         | Per-element-type renderers         |
| `src/components/editor/EditorCanvas.tsx`    | Interactive editing canvas         |
| `src/components/editor/PropertyPanel.tsx`   | Selected element properties        |
| `src/components/editor/SlideList.tsx`       | Sidebar slide thumbnails           |
| `src/components/editor/CodePanel.tsx`       | Monaco JSON editor                 |
| `docs/ai-slide-guide.md`                    | AI-facing deck.json specification  |
