# Project Structure

A Deckode project is a folder with this layout:

```
my-project/
  deck.json            # The presentation (source of truth)
  slides/              # External slide files (optional, referenced via $ref)
    intro.json
    demo.json
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
    deckode-guide.md   # Navigation index
    guide/             # Detailed spec files (split by section)
```

Your primary task is to read and write `deck.json`. Assets go in `assets/` with relative paths (`"./assets/photo.png"`).

# Core Concept

A Deckode presentation is a single `deck.json` file (with optional `$ref` splits). It is a JSON scene graph: a tree of slides, each containing positioned elements. You produce this JSON. Deckode renders it.


# Coordinate System

- Virtual canvas: **960 x 540** pixels (16:9 aspect ratio)
- Origin `(0, 0)` is the **top-left** corner of the slide
- All `position` and `size` values use this virtual coordinate space
- The renderer scales the virtual canvas to fit the actual viewport

