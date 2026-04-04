# deck.json Schema

## Top-Level Structure

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
    "image": { "objectFit": "fill" },
    "video": { "objectFit": "contain" },
    "tikz": { "backgroundColor": "#1e1e2e" },
    "table": { "headerBackground": "#1e293b", "borderColor": "#334155" }
  },
  "pageNumbers": { "enabled": true, "position": "bottom-right", "format": "number" },
  "components": {
    "comp-a1b2c3d4": {
      "id": "comp-a1b2c3d4",
      "name": "My Component",
      "elements": [ ... ],
      "size": { "w": 200, "h": 100 }
    }
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
| `pageNumbers` | object | no | Page number overlay config (see Page Numbers section below) |
| `components` | object | no | Shared components referenced by `"reference"` elements (see Shared Components below) |

## Slide Object

```json
{
  "id": "s1",
  "layout": "blank",
  "bookmark": "Introduction",
  "background": { "color": "#0f172a" },
  "transition": { "type": "fade", "duration": 300 },
  "notes": "Speaker notes for this slide\n// This line is hidden in presenter mode",
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
| `hidden` | boolean | no | Hide this slide from presentation and export |
| `hidePageNumber` | boolean | no | Suppress page number on this slide (when page numbers are enabled globally) |
| `bookmark` | string | no | Bookmark title. Appears in presenter bookmark list for quick navigation |
| `notes` | string | no | Speaker notes (plain text or Markdown) |
| `elements` | array | yes | Array of Element objects |
| `animations` | array | no | Array of Animation objects |
| `comments` | array | no | Array of Comment objects (editor-only, not exported to PDF/PPTX) |

### Comments

Comments are editor-only review annotations attached to a slide or a specific element. They are not rendered on the canvas or exported.

```json
{
  "id": "c1",
  "elementId": "e3",
  "text": "Consider using a darker shade here",
  "author": "user",
  "category": "design",
  "createdAt": 1710700000000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique comment ID (8-char UUID) |
| `elementId` | string | no | Target element ID. Omit for slide-level comments |
| `text` | string | yes | Comment content |
| `author` | string | no | Who wrote the comment (`"user"` for editor, agent name for AI) |
| `category` | string | no | `"content"` \| `"design"` \| `"bug"` \| `"todo"` \| `"question"` |
| `createdAt` | number | yes | Timestamp (ms since epoch) |

Comments are color-coded by author in the editor. Each category has a distinct badge color. When elements are deleted, their associated comments are automatically removed.

## Element Object

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
| `size` | object | yes | `{ "w": number, "h": number }` in virtual coordinates. `h` can be omitted if `aspectRatio` is provided: `{ "w": 400, "aspectRatio": 1.778 }` → h is computed as `w / aspectRatio` (400 / 1.778 ≈ 225). Common ratios: 16:9 = `1.778`, 4:3 = `1.333`, 1:1 = `1`. **Recommended for images** to preserve original ratio. |
| `style` | object | no | Type-specific styling |
| `rotation` | number | no | Rotation in degrees (clockwise) |
| `groupId` | string | no | Group identifier. Elements sharing the same `groupId` form a group — they move and scale together. |

## Grouping

Elements can be grouped by assigning the same `groupId` string. Grouped elements behave as a unit:

- Clicking any member selects the entire group
- Dragging moves all members together
- Resizing scales all members proportionally
- A purple dashed bounding box appears around the group

Grouping is flat (1-level only). Grouping elements that already belong to different groups merges them into one group.

**Convention:** use `"group-"` prefix followed by a short identifier (e.g., `"group-box-a"`).

**Arrow connectors must always be grouped with their label.** An arrow element (`"shape": "arrow"`) and its associated text label should share the same `groupId` so they stay aligned when moved:

```json
{
  "id": "arrow-1",
  "type": "shape", "shape": "arrow",
  "position": { "x": 240, "y": 155 },
  "size": { "w": 80, "h": 1 },
  "style": { "stroke": "#64748b", "strokeWidth": 2, "waypoints": [{ "x": 0, "y": 0 }, { "x": 80, "y": 0 }] },
  "groupId": "group-arrow-1"
},
{
  "id": "label-1",
  "type": "text",
  "content": "Yes",
  "position": { "x": 255, "y": 138 },
  "size": { "w": 50, "h": 18 },
  "style": { "fontSize": 12, "color": "#64748b", "textAlign": "center" },
  "groupId": "group-arrow-1"
}
```

Similarly, box + label pairs in diagrams should be grouped:

```json
{
  "id": "box-input", "type": "shape", "shape": "rectangle",
  "position": { "x": 80, "y": 130 }, "size": { "w": 160, "h": 70 },
  "style": { "fill": "#dbeafe", "stroke": "#3b82f6", "strokeWidth": 2, "borderRadius": 10 },
  "groupId": "group-input"
},
{
  "id": "label-input", "type": "text",
  "content": "**Input**\nUser request",
  "position": { "x": 80, "y": 130 }, "size": { "w": 160, "h": 70 },
  "style": { "fontSize": 14, "color": "#1e40af", "textAlign": "center", "verticalAlign": "middle" },
  "groupId": "group-input"
}
```

## Shared Components

A group can be promoted to a **shared component** — a reusable set of elements that lives in `deck.components`. Slides reference components via `"reference"` elements. Editing a component updates all references.

### Component Object

```json
{
  "id": "comp-a1b2c3d4",
  "name": "Header Block",
  "elements": [
    { "id": "e10", "type": "shape", "shape": "rectangle", "position": { "x": 0, "y": 0 }, "size": { "w": 200, "h": 60 }, "style": { "fill": "#3b82f6" } },
    { "id": "e11", "type": "text", "content": "Title", "position": { "x": 10, "y": 15 }, "size": { "w": 180, "h": 30 }, "style": { "color": "#ffffff" } }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique component ID (`"comp-"` prefix) |
| `name` | string | yes | Human-readable name |
| `elements` | array | yes | Child elements with positions relative to (0,0) |

The component's bounding box is computed dynamically from its elements — no stored `size` field needed.

### Referencing a Component

Place a `"reference"` element on any slide (see `"reference"` element type below). Multiple references can point to the same component. The reference's `size` can differ from the component's `size` — children are scaled proportionally.

### Lifecycle

- **Create:** group elements → right-click → "Create Component". The group is replaced by a reference element.
- **Edit:** double-click a reference → edit mode. Changes apply to all references.
- **Detach:** right-click a reference → "Detach (Inline)". Converts back to individual elements; other references are unaffected.
- **Garbage collection:** components with no remaining references are removed on save.

