# Deckode Guide

You are creating slides for Deckode, a local-first, JSON-based slide platform. This is the navigation index for the complete specification. Read the relevant section files below as needed.

> **Read order for new decks**: Overview → Schema → Elements → Animations → Guidelines
>
> **Read order for modifications**: Schema (to understand structure) → the specific section you need

## Sections

| # | File | Description |
|---|------|-------------|
| 1 | [Overview](./guide/01-overview.md) | Project structure, core concept, coordinate system (960×540 virtual canvas) |
| 2 | [Slide Splitting](./guide/02-slide-splitting.md) | `$ref` pointers for splitting large decks into external slide files |
| 3 | [Schema](./guide/03-schema.md) | `deck.json` top-level structure, slide object, element object, grouping, shared components |
| 4 | [Element Types](./guide/04-elements.md) | All element types: text, image, code, shape, tikz, mermaid, table, custom, video, scene3d, reference |
| 5 | [Animations](./guide/05-animations.md) | Animation triggers, effects, and sequencing examples |
| 6 | [Theme](./guide/06-theme.md) | Deck-level theme defaults and page number overlay |
| 7 | [Slide Features](./guide/07-slide-features.md) | Bookmarks, presenter notes, speaker notes, layout templates, rotation |
| 8 | [Guidelines](./guide/08-guidelines.md) | Common pitfalls (must-read) and AI best practices for creating/modifying decks |
| 9 | [Complete Example](./guide/09-example.md) | A full 3-slide deck.json example |

## Quick Reference

- **Virtual canvas**: 960 × 540 (16:9)
- **Slide IDs**: `"s1"`, `"s2"`, ...
- **Element IDs**: `"e1"`, `"e2"`, ... (unique within slide)
- **Resolution order**: `element.style` > `deck.theme` > hardcoded defaults
- **Critical pitfalls**: No `**` in LaTeX math, no `rotation` on line/arrow, always provide `waypoints` for line/arrow
