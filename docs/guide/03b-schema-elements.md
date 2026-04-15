<!-- guide-meta: {"label":"Schema: Elements & Components","desc":"Element common fields, grouping, shared components"} -->
# Element Object

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
| `allowOverlap` | boolean | no | Opt out of the validator's overlap check for this element. Use for intentional overlays the detector can't infer (rare — most cases are handled automatically). |

## Overlap check

`validateDeck` and the CLI validator flag pairs of elements whose bounding boxes visibly overlap. Several patterns are **auto-exempted** and never reported:

- **Line/arrow shapes** — `"shape": "line"` and `"shape": "arrow"` are excluded entirely (their bbox is an enclosure of the polyline path, not a visual region, so fan-out diagrams with arrows sharing an origin don't trigger false positives).
- **Shape + content** — a shape overlapping a text/table/code element is treated as decorative framing.
- **Container** — a rectangle that fully encloses another element is treated as a frame (frame-around-image, highlight box around a screenshot).
- **Label-on-box** — a small element >90% contained inside a much larger one.
- **Annotation** — any pair with an area ratio > 4×.
- **Shared groupId** — elements in the same group.
- **Image overlays** — if either element is an image, overlap is capped at *warning* severity (never an error), since captions and callouts on images are common and legitimate.

If none of these fit and you still want to silence the check on a specific element, set `"allowOverlap": true` on it.

**Image elements have additional semantic fields**: `alt` (required in practice for accessibility and AI context), `caption` (longer description), `description` (free-form detail), and `aiSummary` (auto-generated multimodal caption cached from a Gemini call). See `04b-elem-media` for the full image schema and captioning rules.

## Grouping

Elements can be grouped by assigning the same `groupId` string. Grouped elements behave as a unit:

- Clicking any member selects the entire group
- Dragging moves all members together
- Resizing scales all members proportionally
- A purple dashed bounding box appears around the group

Grouping is flat (1-level only). Grouping elements that already belong to different groups merges them into one group.

**Convention:** use `"group-"` prefix followed by a short identifier (e.g., `"group-box-a"`).

**Arrow connectors must always be grouped with their label.** An arrow element (`"shape": "arrow"`) and its associated text label should share the same `groupId` so they stay aligned when moved.

**For labeled rectangles and ellipses, prefer the built-in `text` field** on the shape element instead of overlaying a separate text element. This keeps the shape and label as a single element for animation and positioning. See `04c-elem-shape.md` for the `text`/`textStyle` fields.

See the shape and diagram guide files for grouping examples.

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

