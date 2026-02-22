# Deckode AI Slide Guide

You are creating slides for Deckode, a local-first, JSON-based slide platform. This document is the complete specification for generating and modifying slide decks. It is the only reference you need.

---

## Project Structure

A Deckode project is a folder with this layout:

```
my-project/
  deck.json            # The presentation (source of truth)
  layouts/             # Layout templates (pre-positioned element sets)
    blank.json
    title.json
    title-content.json
    two-column.json
    section-header.json
    code-slide.json
    image-left.json
  assets/              # Images, videos, and other media (created on demand)
  components/          # Custom React components (optional, dev mode only)
  docs/
    ai-slide-guide.md  # This file
```

Your primary task is to read and write `deck.json`. Assets go in `assets/` with relative paths (`"./assets/photo.png"`).

---

## Core Concept

A Deckode presentation is a single `deck.json` file. It is a JSON scene graph: a tree of slides, each containing positioned elements. You produce this JSON. Deckode renders it.

---

## Coordinate System

- Virtual canvas: **960 x 540** pixels (16:9 aspect ratio)
- Origin `(0, 0)` is the **top-left** corner of the slide
- All `position` and `size` values use this virtual coordinate space
- The renderer scales the virtual canvas to fit the actual viewport

---

## deck.json Schema

### Top-Level Structure

```json
{
  "deckode": "0.1.0",
  "meta": {
    "title": "Presentation Title",
    "author": "Author Name",
    "aspectRatio": "16:9"
  },
  "theme": {
    "slide": { "background": { "color": "#0f172a" } },
    "text": { "fontFamily": "Inter, system-ui, sans-serif", "fontSize": 24, "color": "#ffffff" },
    "code": { "theme": "github-dark", "fontSize": 16 },
    "shape": { "stroke": "#ffffff", "strokeWidth": 1 },
    "image": { "objectFit": "contain" },
    "video": { "objectFit": "contain" },
    "tikz": { "backgroundColor": "#1e1e2e" },
    "table": { "headerBackground": "#1e293b", "borderColor": "#334155" }
  },
  "slides": [ ... ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deckode` | string | yes | Schema version. Use `"0.1.0"` |
| `meta.title` | string | yes | Presentation title |
| `meta.author` | string | no | Author name |
| `meta.aspectRatio` | `"16:9"` \| `"4:3"` | yes | Slide aspect ratio |
| `theme` | object | no | Deck-level default styles (see Theme section below) |

### Slide Object

```json
{
  "id": "s1",
  "layout": "blank",
  "background": { "color": "#0f172a" },
  "transition": { "type": "fade", "duration": 300 },
  "notes": "Speaker notes for this slide",
  "elements": [ ... ],
  "animations": [ ... ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique slide ID. Convention: `"s1"`, `"s2"`, ... |
| `layout` | string | no | Layout template name. Default: `"blank"` |
| `background` | object | no | Slide background |
| `background.color` | string | no | CSS color value |
| `background.image` | string | no | Path to image (`"./assets/bg.jpg"`) |
| `transition` | object | no | Slide enter transition |
| `transition.type` | `"fade"` \| `"slide"` \| `"none"` | no | Transition type |
| `transition.duration` | number | no | Duration in ms. Default: `300` |
| `notes` | string | no | Speaker notes (plain text or Markdown) |
| `elements` | array | yes | Array of Element objects |
| `animations` | array | no | Array of Animation objects |

### Element Object

Every element has these common fields:

```json
{
  "id": "e1",
  "type": "text",
  "position": { "x": 100, "y": 200 },
  "size": { "w": 400, "h": 120 },
  "style": { ... },
  "content": "..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique element ID within the slide. Convention: `"e1"`, `"e2"`, ... |
| `type` | string | yes | Element type (see below) |
| `position` | object | yes | `{ "x": number, "y": number }` in virtual coordinates |
| `size` | object | yes | `{ "w": number, "h": number }` in virtual coordinates |
| `style` | object | no | Type-specific styling |
| `rotation` | number | no | Rotation in degrees (clockwise) |

---

## Element Types

### `"text"`

Renders Markdown text content.

```json
{
  "id": "e1",
  "type": "text",
  "content": "# Title\n\nThis is **bold** and *italic*.\n\nInline math: $E = mc^2$",
  "position": { "x": 60, "y": 40 },
  "size": { "w": 840, "h": 200 },
  "style": {
    "fontFamily": "Inter",
    "fontSize": 24,
    "color": "#ffffff",
    "textAlign": "left",
    "lineHeight": 1.5,
    "verticalAlign": "top"
  }
}
```

**Content format**: Markdown string. Supports:
- Headings (`#`, `##`, `###`)
- Bold (`**text**`), italic (`*text*`)
- Inline code (`` `code` ``)
- Links (`[text](url)`)
- Unordered lists (`- item`)
- Inline math (`$E = mc^2$`)
- Block math (`$$\int_0^1 f(x) dx$$`)

**Style fields**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `fontFamily` | string | `"Inter"` | Font family |
| `fontSize` | number | `24` | Base font size in px (headings scale relative to this) |
| `color` | string | `"#ffffff"` | Text color |
| `textAlign` | `"left"` \| `"center"` \| `"right"` | `"left"` | Horizontal alignment |
| `lineHeight` | number | `1.5` | Line height multiplier |
| `verticalAlign` | `"top"` \| `"middle"` \| `"bottom"` | `"top"` | Vertical alignment within the box |

### `"image"`

Renders an image.

```json
{
  "id": "e2",
  "type": "image",
  "src": "./assets/diagram.png",
  "position": { "x": 500, "y": 100 },
  "size": { "w": 400, "h": 300 },
  "style": {
    "objectFit": "contain",
    "borderRadius": 8,
    "opacity": 1
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `src` | string | yes | Image path relative to project root, or absolute URL |

**Style fields**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `objectFit` | `"contain"` \| `"cover"` \| `"fill"` | `"contain"` | Image fit behavior |
| `borderRadius` | number | `0` | Corner radius in px |
| `opacity` | number | `1` | Opacity (0-1) |
| `border` | string | none | CSS border (e.g., `"2px solid #fff"`) |

### `"code"`

Renders a syntax-highlighted code block.

```json
{
  "id": "e3",
  "type": "code",
  "language": "typescript",
  "content": "const greeting = (name: string) => {\n  return `Hello, ${name}!`;\n};",
  "position": { "x": 60, "y": 300 },
  "size": { "w": 840, "h": 180 },
  "style": {
    "theme": "github-dark",
    "fontSize": 16,
    "lineNumbers": false,
    "highlightLines": [2]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `language` | string | yes | Language identifier (e.g., `"typescript"`, `"python"`, `"rust"`) |
| `content` | string | yes | Raw code string |

**Style fields**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `theme` | string | `"github-dark"` | Shiki theme name |
| `fontSize` | number | `16` | Font size in px |
| `lineNumbers` | boolean | `false` | Show line numbers |
| `highlightLines` | number[] | `[]` | 1-indexed line numbers to highlight |
| `borderRadius` | number | `8` | Corner radius |

### `"shape"`

Renders a geometric shape.

```json
{
  "id": "e4",
  "type": "shape",
  "shape": "rectangle",
  "position": { "x": 100, "y": 100 },
  "size": { "w": 200, "h": 200 },
  "style": {
    "fill": "#3b82f6",
    "stroke": "#60a5fa",
    "strokeWidth": 2,
    "borderRadius": 16,
    "opacity": 0.8
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shape` | `"rectangle"` \| `"ellipse"` \| `"line"` \| `"arrow"` | yes | Shape type |

**Style fields**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `fill` | string | `"transparent"` | Fill color |
| `stroke` | string | `"#ffffff"` | Stroke color |
| `strokeWidth` | number | `1` | Stroke width in px |
| `borderRadius` | number | `0` | Corner radius (rectangle only) |
| `opacity` | number | `1` | Opacity (0-1) |

For `"line"` and `"arrow"`: `position` is the start point. The line extends horizontally by `size.w` pixels. `size.h` is ignored (set to a small value like `4` for the click target).

**Line example** (horizontal divider):
```json
{
  "id": "divider",
  "type": "shape",
  "shape": "line",
  "position": { "x": 60, "y": 260 },
  "size": { "w": 840, "h": 4 },
  "style": { "stroke": "#475569", "strokeWidth": 1 }
}
```

**Arrow example** (pointing right):
```json
{
  "id": "flow-arrow",
  "type": "shape",
  "shape": "arrow",
  "position": { "x": 200, "y": 300 },
  "size": { "w": 560, "h": 4 },
  "style": { "stroke": "#3b82f6", "strokeWidth": 3 }
}
```

### `"tikz"`

Renders a TikZ/PGFPlots diagram via a WASM-based TeX engine (compiled entirely in the browser).

```json
{
  "id": "e6",
  "type": "tikz",
  "content": "\\begin{tikzpicture}\n  \\draw[thick, blue, ->] (0,0) -- (3,2) node[right] {$\\vec{v}$};\n  \\draw[thick, red, ->] (0,0) -- (2,-1) node[right] {$\\vec{u}$};\n  \\draw[dashed, gray] (3,2) -- (5,1);\n  \\draw[dashed, gray] (2,-1) -- (5,1);\n  \\draw[thick, purple, ->] (0,0) -- (5,1) node[right] {$\\vec{v}+\\vec{u}$};\n\\end{tikzpicture}",
  "position": { "x": 200, "y": 100 },
  "size": { "w": 560, "h": 340 },
  "preamble": "",
  "style": {
    "backgroundColor": "#1e1e2e",
    "borderRadius": 8
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | yes | TikZ source code (the body inside `\begin{tikzpicture}...\end{tikzpicture}`) |
| `svgUrl` | string | no | URL to a pre-rendered SVG. If provided, the renderer uses this instead of compiling |
| `preamble` | string | no | Additional LaTeX preamble (e.g., extra `\usepackage{}` declarations). `pgfplots` and `pgfplotsset{compat=1.18}` are included by default |

**Style fields**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `backgroundColor` | string | `"#1e1e2e"` | Background color behind the rendered SVG |
| `borderRadius` | number | `0` | Corner radius in px |

**PGFPlots example** (bar chart):
```json
{
  "id": "chart",
  "type": "tikz",
  "content": "\\begin{tikzpicture}\n  \\begin{axis}[\n    ybar,\n    bar width=20pt,\n    xlabel={Category},\n    ylabel={Value},\n    symbolic x coords={A, B, C, D},\n    xtick=data,\n    nodes near coords,\n    axis lines=left,\n    enlarge x limits=0.2\n  ]\n    \\addplot coordinates {(A,45) (B,72) (C,38) (D,91)};\n  \\end{axis}\n\\end{tikzpicture}",
  "position": { "x": 160, "y": 80 },
  "size": { "w": 640, "h": 400 },
  "style": { "backgroundColor": "#0f172a" }
}
```

### `"table"`

Renders a data table with column headers and rows.

```json
{
  "id": "e8",
  "type": "table",
  "columns": ["Name", "Role", "Status"],
  "rows": [
    ["Alice", "Engineer", "Active"],
    ["Bob", "Designer", "Active"],
    ["Carol", "PM", "On Leave"]
  ],
  "position": { "x": 60, "y": 120 },
  "size": { "w": 500, "h": 200 },
  "style": {
    "fontSize": 14,
    "color": "#e2e8f0",
    "headerBackground": "#1e293b",
    "headerColor": "#f8fafc",
    "borderColor": "#334155",
    "striped": true,
    "borderRadius": 8
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `columns` | string[] | yes | Header labels for each column |
| `rows` | string[][] | yes | 2D array of cell data. Each inner array is one row |

**Style fields**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `fontSize` | number | `14` | Font size in px |
| `color` | string | `"#e2e8f0"` | Body text color |
| `headerBackground` | string | `"#1e293b"` | Header row background color |
| `headerColor` | string | `"#f8fafc"` | Header row text color |
| `borderColor` | string | `"#334155"` | Border/divider color |
| `striped` | boolean | `false` | Alternate row background shading |
| `borderRadius` | number | `8` | Corner radius of the table container |

### `"custom"`

Renders a user-defined React component loaded from the project's `components/` directory.

```json
{
  "id": "e7",
  "type": "custom",
  "component": "InteractiveChart",
  "props": {
    "data": [10, 25, 40, 30, 55],
    "color": "#3b82f6",
    "animated": true
  },
  "position": { "x": 100, "y": 100 },
  "size": { "w": 760, "h": 380 }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `component` | string | yes | Component filename (without extension) from the project's `components/` directory |
| `props` | object | no | Arbitrary props passed to the component. The component also receives `size: { w, h }` automatically |

The component must be a default-exported React component placed in the project folder (e.g., `components/InteractiveChart.tsx`).

### `"video"`

Renders a video player. Supports local MP4/WebM files, YouTube URLs, and Vimeo URLs.

```json
{
  "id": "e5",
  "type": "video",
  "src": "./assets/demo.mp4",
  "position": { "x": 60, "y": 100 },
  "size": { "w": 840, "h": 380 },
  "autoplay": false,
  "loop": false,
  "muted": false,
  "controls": true,
  "style": {
    "objectFit": "contain",
    "borderRadius": 8
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `src` | string | yes | Video source: local path (`./assets/video.mp4`), YouTube URL, or Vimeo URL |
| `autoplay` | boolean | no | Auto-play when slide is shown. Default: `false` |
| `loop` | boolean | no | Loop playback. Default: `false` |
| `muted` | boolean | no | Mute audio. Default: `false` |
| `controls` | boolean | no | Show player controls. Default: `false` |

**Style fields**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `objectFit` | `"contain"` \| `"cover"` \| `"fill"` | `"contain"` | Video fit behavior |
| `borderRadius` | number | `0` | Corner radius in px |

**Source URL handling**:

- **Local files**: `"./assets/video.mp4"` — served from the project's assets folder
- **YouTube**: `"https://www.youtube.com/watch?v=VIDEO_ID"` or `"https://youtu.be/VIDEO_ID"` — auto-converted to embed iframe
- **Vimeo**: `"https://vimeo.com/VIDEO_ID"` — auto-converted to embed iframe

**Video examples**:

Local MP4 with autoplay (muted required for browser autoplay policy):
```json
{
  "id": "bg-video",
  "type": "video",
  "src": "./assets/background.mp4",
  "position": { "x": 0, "y": 0 },
  "size": { "w": 960, "h": 540 },
  "autoplay": true,
  "loop": true,
  "muted": true,
  "style": { "objectFit": "cover" }
}
```

YouTube embed with controls:
```json
{
  "id": "yt-demo",
  "type": "video",
  "src": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "position": { "x": 180, "y": 80 },
  "size": { "w": 600, "h": 338 },
  "controls": true,
  "muted": true
}
```

---

## Animations

Animations are defined per-slide and reference elements by ID.

```json
{
  "animations": [
    { "target": "e1", "trigger": "onEnter", "effect": "fadeIn", "delay": 0, "duration": 400 },
    { "target": "e2", "trigger": "onClick", "effect": "slideInLeft", "delay": 200, "duration": 500 },
    { "target": "e3", "trigger": "afterPrevious", "effect": "fadeIn", "duration": 300 },
    { "target": "e4", "trigger": "withPrevious", "effect": "scaleIn", "duration": 400 },
    { "target": "e5", "trigger": "onKey", "key": "v", "effect": "fadeIn", "duration": 300 }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target` | string | yes | Element ID to animate |
| `trigger` | string | yes | When to trigger (see below) |
| `effect` | string | yes | Animation effect name |
| `delay` | number | no | Delay in ms. Default: `0` |
| `duration` | number | no | Duration in ms. Default: `400` |
| `order` | number | no | Explicit animation sequence number. Controls the step order for `onClick` triggers |
| `key` | string | no | Key to press (required when trigger is `"onKey"`) |

**Triggers**:

| Trigger | Description |
|---------|-------------|
| `"onEnter"` | Plays automatically when the slide is entered |
| `"onClick"` | Plays on click/spacebar/right-arrow (advances through one step at a time) |
| `"afterPrevious"` | Auto-plays after the previous animation finishes |
| `"withPrevious"` | Plays simultaneously with the previous animation |
| `"onKey"` | Plays when a specific key is pressed (requires `key` field) |

**Available effects**: `fadeIn`, `fadeOut`, `slideInLeft`, `slideInRight`, `slideInUp`, `slideInDown`, `scaleIn`, `scaleOut`, `typewriter`

### Animation Examples

**Step-by-step reveal** (click to reveal each bullet):
```json
{
  "animations": [
    { "target": "bullet1", "trigger": "onClick", "effect": "fadeIn", "duration": 300 },
    { "target": "bullet2", "trigger": "onClick", "effect": "fadeIn", "duration": 300 },
    { "target": "bullet3", "trigger": "onClick", "effect": "fadeIn", "duration": 300 }
  ]
}
```

**Auto-cascade** (elements appear one after another):
```json
{
  "animations": [
    { "target": "title", "trigger": "onEnter", "effect": "slideInDown", "duration": 400 },
    { "target": "subtitle", "trigger": "afterPrevious", "effect": "fadeIn", "delay": 100, "duration": 300 },
    { "target": "image", "trigger": "afterPrevious", "effect": "scaleIn", "duration": 500 }
  ]
}
```

**Video reveal on click** (click to fade in a video player):
```json
{
  "elements": [
    {
      "id": "play-label",
      "type": "text",
      "content": "Click to play demo",
      "position": { "x": 300, "y": 250 },
      "size": { "w": 360, "h": 40 },
      "style": { "fontSize": 20, "color": "#94a3b8", "textAlign": "center" }
    },
    {
      "id": "demo-video",
      "type": "video",
      "src": "./assets/demo.mp4",
      "position": { "x": 80, "y": 80 },
      "size": { "w": 800, "h": 400 },
      "autoplay": true,
      "muted": true,
      "controls": true
    }
  ],
  "animations": [
    { "target": "demo-video", "trigger": "onClick", "effect": "fadeIn", "duration": 400 },
    { "target": "play-label", "trigger": "withPrevious", "effect": "fadeOut", "duration": 200 }
  ]
}
```

---

## Theme

The optional top-level `theme` object provides default styles per element type. These act as a middle layer between hardcoded defaults and per-element `style` overrides.

**Resolution order**: `element.style` > `deck.theme` > hardcoded defaults

Each key in the theme object corresponds to an element type and accepts the same style fields as that element's `style` property.

| Theme key | Style fields | Hardcoded defaults |
|-----------|-------------|-------------------|
| `theme.slide.background` | `color`, `image` | `color: "#0f172a"` |
| `theme.text` | `fontFamily`, `fontSize`, `color`, `textAlign`, `lineHeight`, `verticalAlign` | `fontFamily: "Inter"`, `fontSize: 24`, `color: "#ffffff"`, `lineHeight: 1.5` |
| `theme.code` | `theme`, `fontSize`, `lineNumbers`, `borderRadius` | `theme: "github-dark"`, `fontSize: 16`, `borderRadius: 8` |
| `theme.shape` | `fill`, `stroke`, `strokeWidth`, `borderRadius`, `opacity` | `stroke: "#ffffff"`, `strokeWidth: 1` |
| `theme.image` | `objectFit`, `borderRadius`, `opacity` | `objectFit: "contain"` |
| `theme.video` | `objectFit`, `borderRadius` | `objectFit: "contain"` |
| `theme.tikz` | `backgroundColor`, `borderRadius` | `backgroundColor: "#1e1e2e"` |
| `theme.table` | `fontSize`, `color`, `headerBackground`, `headerColor`, `borderColor`, `striped`, `borderRadius` | `fontSize: 14`, `headerBackground: "#1e293b"` |

To change the default text color for the entire deck to red without touching individual elements:

```json
{
  "theme": { "text": { "color": "#ff0000" } }
}
```

Elements with an explicit `style.color` will still use their own value.

---

## Layout Templates

Deckode includes built-in layout templates that provide pre-positioned elements as a starting point for slides. Set the `layout` field on a slide to use one. Elements from the template are merged into the slide; you can override them or add more.

| Layout Name | Description |
|-------------|-------------|
| `"blank"` | Empty slide with only a background. The default when no layout is specified |
| `"title"` | Large centered title with optional subtitle |
| `"title-content"` | Heading at top + body text area below |
| `"two-column"` | Heading + two side-by-side content columns |
| `"section-header"` | Full-slide section divider with centered text |
| `"code-slide"` | Heading + large code block area |
| `"image-left"` | Image on the left half, text content on the right |

**Usage**: Set the `layout` field on a slide object:

```json
{
  "id": "s1",
  "layout": "title-content",
  "elements": [
    {
      "id": "heading",
      "type": "text",
      "content": "## My Custom Title",
      "position": { "x": 60, "y": 30 },
      "size": { "w": 840, "h": 60 },
      "style": { "fontSize": 32, "color": "#f8fafc" }
    },
    {
      "id": "body",
      "type": "text",
      "content": "Content goes here...",
      "position": { "x": 60, "y": 110 },
      "size": { "w": 840, "h": 380 },
      "style": { "fontSize": 20, "color": "#cbd5e1" }
    }
  ]
}
```

---

## Speaker Notes

Each slide can have a `notes` field with plain text or Markdown content. Notes are displayed in the presenter console during presentations.

### Animation-Aware Notes

Use `[step:N]...[/step]` markers to highlight sections of your notes as animations progress. This helps presenters know what to say at each animation step.

```json
{
  "id": "s2",
  "notes": "Welcome everyone to today's talk.\n\n[step:1]First, let's look at the problem statement. Our current tools are too restrictive.[/step]\n\n[step:2]Here's our proposed solution — a JSON-based approach that gives full control.[/step]\n\n[step:3]And these are the results from our beta testing.[/step]",
  "elements": [ ... ],
  "animations": [
    { "target": "problem", "trigger": "onClick", "effect": "fadeIn" },
    { "target": "solution", "trigger": "onClick", "effect": "slideInLeft" },
    { "target": "results", "trigger": "onClick", "effect": "fadeIn" }
  ]
}
```

**Behavior**:
- Text outside `[step:N]...[/step]` markers is always visible
- Text inside markers is dimmed by default and highlighted (yellow) when the animation reaches that step
- Steps correspond to the order of `onClick` animations: the first `onClick` is step 1, the second is step 2, etc.

---

## Rotation

Any element can be rotated by setting the `rotation` field (degrees, clockwise).

```json
{
  "id": "label",
  "type": "text",
  "content": "DRAFT",
  "position": { "x": 300, "y": 200 },
  "size": { "w": 360, "h": 80 },
  "rotation": -15,
  "style": { "fontSize": 48, "color": "#ef444480", "textAlign": "center" }
}
```

Rotation is applied as a CSS `transform: rotate()` on the element's bounding box. The element rotates around its center point.

---

## Guidelines for AI

### Creating a New Deck

1. Start with the top-level structure including `deckode` version and `meta`
2. Create slides with unique sequential IDs (`s1`, `s2`, ...)
3. Within each slide, create elements with unique sequential IDs (`e1`, `e2`, ...)
4. Position elements thoughtfully — avoid overlaps unless intentional
5. Use the full 960x540 canvas. Leave margins (~40-60px) for visual breathing room

### Layout Tips

- **Title slides**: Large centered text (fontSize 48-64), optionally a subtitle below
- **Content slides**: Title at top (y: 30-60), body content below (y: 120+)
- **Two-column**: Left column x: 40-460, right column x: 500-920
- **Full-bleed image**: position `{ "x": 0, "y": 0 }`, size `{ "w": 960, "h": 540 }`
- **Code walkthrough**: Code block on left/top, explanation text on right/bottom

### Color Palettes

Use consistent color schemes. Here are some starting points:

**Dark (default)**:
- Background: `#0f172a` (slate-900)
- Text: `#f8fafc` (slate-50)
- Accent: `#3b82f6` (blue-500)
- Secondary: `#94a3b8` (slate-400)

**Light**:
- Background: `#ffffff`
- Text: `#1e293b` (slate-800)
- Accent: `#2563eb` (blue-600)
- Secondary: `#64748b` (slate-500)

### Content Best Practices

- Keep text concise — slides are not documents
- One idea per slide
- Use Markdown headings to establish hierarchy
- Use `**bold**` for emphasis, sparingly
- Code blocks: show only the relevant lines, not entire files
- Speaker notes (`notes` field) can hold the detailed explanation

### Modifying an Existing Deck

When asked to modify an existing deck:
1. Preserve all existing `id` values — do not regenerate them
2. When adding new elements, use IDs that don't conflict with existing ones
3. When moving elements, only change `position` — preserve all other fields
4. When restyling, only change `style` fields — preserve content and position

---

## Complete Example

```json
{
  "deckode": "0.1.0",
  "meta": {
    "title": "Introduction to Deckode",
    "author": "Son",
    "aspectRatio": "16:9"
  },
  "theme": {
    "slide": { "background": { "color": "#0f172a" } },
    "text": { "color": "#f8fafc" }
  },
  "slides": [
    {
      "id": "s1",
      "background": { "color": "#0f172a" },
      "elements": [
        {
          "id": "e1",
          "type": "text",
          "content": "# Deckode\n\nSlides as Code, Powered by AI",
          "position": { "x": 180, "y": 160 },
          "size": { "w": 600, "h": 220 },
          "style": { "fontSize": 48, "color": "#f8fafc", "textAlign": "center" }
        },
        {
          "id": "e2",
          "type": "shape",
          "shape": "rectangle",
          "position": { "x": 330, "y": 400 },
          "size": { "w": 300, "h": 4 },
          "style": { "fill": "#3b82f6" }
        }
      ],
      "animations": [
        { "target": "e1", "trigger": "onEnter", "effect": "fadeIn", "duration": 600 },
        { "target": "e2", "trigger": "onEnter", "effect": "scaleIn", "delay": 400, "duration": 400 }
      ]
    },
    {
      "id": "s2",
      "background": { "color": "#0f172a" },
      "notes": "Explain the core problem with existing tools",
      "elements": [
        {
          "id": "e1",
          "type": "text",
          "content": "## The Problem",
          "position": { "x": 60, "y": 40 },
          "size": { "w": 840, "h": 60 },
          "style": { "fontSize": 36, "color": "#f8fafc" }
        },
        {
          "id": "e2",
          "type": "text",
          "content": "- **Gamma/Tome**: Cloud-locked, no code access\n- **Slidev/Marp**: Code-only, no visual editor\n- **PowerPoint**: No AI, no web-native features",
          "position": { "x": 60, "y": 130 },
          "size": { "w": 500, "h": 280 },
          "style": { "fontSize": 22, "color": "#cbd5e1", "lineHeight": 1.8 }
        },
        {
          "id": "e3",
          "type": "shape",
          "shape": "rectangle",
          "position": { "x": 600, "y": 130 },
          "size": { "w": 320, "h": 280 },
          "style": { "fill": "#1e293b", "borderRadius": 12 }
        },
        {
          "id": "e4",
          "type": "text",
          "content": "### Deckode\n\nJSON + Visual Editor\n+ AI Agent\n= Full Control",
          "position": { "x": 620, "y": 150 },
          "size": { "w": 280, "h": 240 },
          "style": { "fontSize": 20, "color": "#3b82f6", "textAlign": "center", "verticalAlign": "middle" }
        }
      ]
    },
    {
      "id": "s3",
      "background": { "color": "#0f172a" },
      "elements": [
        {
          "id": "e1",
          "type": "text",
          "content": "## How It Works",
          "position": { "x": 60, "y": 40 },
          "size": { "w": 840, "h": 60 },
          "style": { "fontSize": 36, "color": "#f8fafc" }
        },
        {
          "id": "e2",
          "type": "code",
          "language": "json",
          "content": "{\n  \"type\": \"text\",\n  \"content\": \"# Hello World\",\n  \"position\": { \"x\": 120, \"y\": 200 },\n  \"size\": { \"w\": 720, \"h\": 120 }\n}",
          "position": { "x": 60, "y": 130 },
          "size": { "w": 840, "h": 200 },
          "style": { "fontSize": 18, "theme": "github-dark", "borderRadius": 12 }
        },
        {
          "id": "e3",
          "type": "text",
          "content": "Every visual change maps to a JSON field.\nDrag an element → `position` updates.\nResize → `size` updates.\nAI generates this JSON directly.",
          "position": { "x": 60, "y": 370 },
          "size": { "w": 840, "h": 140 },
          "style": { "fontSize": 20, "color": "#94a3b8", "lineHeight": 1.8 }
        }
      ]
    }
  ]
}
```

This example produces a 3-slide deck: a title slide, a problem statement, and a technical overview. The AI should generate similar structures, adapting content, layout, and styling to match the user's request.
