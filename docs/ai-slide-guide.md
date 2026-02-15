# Deckode AI Slide Guide

You are creating slides for Deckode, a JSON-based slide platform. This document is the complete specification for generating and modifying slide decks.

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
    "aspectRatio": "16:9",
    "theme": "default"
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
| `meta.theme` | string | no | Theme name. Default: `"default"` |

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

For `"line"` and `"arrow"`: `position` is the start point, `position + size` is the end point.

---

## Animations

Animations are defined per-slide and reference elements by ID.

```json
{
  "animations": [
    { "target": "e1", "trigger": "onEnter", "effect": "fadeIn", "delay": 0, "duration": 400 },
    { "target": "e2", "trigger": "onClick", "effect": "slideInLeft", "delay": 200, "duration": 500 }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target` | string | yes | Element ID to animate |
| `trigger` | `"onEnter"` \| `"onClick"` | yes | When to trigger |
| `effect` | string | yes | Animation effect name |
| `delay` | number | no | Delay in ms. Default: `0` |
| `duration` | number | no | Duration in ms. Default: `400` |

**Available effects**: `fadeIn`, `fadeOut`, `slideInLeft`, `slideInRight`, `slideInUp`, `slideInDown`, `scaleIn`, `scaleOut`, `typewriter`

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
    "aspectRatio": "16:9",
    "theme": "default"
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
