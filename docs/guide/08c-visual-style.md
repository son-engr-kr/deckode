<!-- guide-meta: {"label":"Visual Style Guide","desc":"Default color palette, typography, layout rules, diagram patterns"} -->
# Visual Style Guide

This guide defines the default visual design system for all agents. User style preferences (theme, animations, notes tone) override these defaults — see [Style Preferences](./08b-style-preferences.md). For layout templates and detailed palette, see [Layout Templates](./08d-layout-templates.md).

## Color Palette — "Analytical Insight"

| Role | Color | Usage |
|------|-------|-------|
| Primary | `#1A2B48` (Deep Navy) | Slide titles, headers, emphasis |
| Data | `#5B9BD5` (Medium Blue) | Chart accents, metric values, highlights |
| Data Light | `#BDD7EE` (Light Sky Blue) | Secondary data, card borders |
| Structure | `#E7E6E6` (Soft Gray) | Divider lines, card fills, thin rules |
| Insight BG | `#F2F2F2` (Light Warm Gray) | Key Insight box background |
| Accent | `#A68966` (Muted Gold) | Section numbers, tags, "KEY INSIGHT" label, title rules |
| Body | `#333333` (Charcoal) | Body text, descriptions |
| Secondary | `#8899AA` | Subtitles, metadata |
| Tertiary | `#AABBCC` | Period labels, captions, footer text |
| Background | `#ffffff` | ALL slides — always white |

**IMPORTANT**: Use ONLY these colors. Do not invent hex values or use colors from other palettes.

## Typography

- Font family: Inter, system-ui, sans-serif
- **Slide title** (content slides): fontSize 18, color `#1A2B48`, bold (`**title**`)
- **Title slide title**: fontSize 36, color `#1A2B48`, bold
- Subtitle/section: fontSize 14, color `#8899AA`
- Body text: fontSize 12-14, color `#333333`, lineHeight 1.5
- Labels in boxes: fontSize 12-14, color `#5B9BD5`, center-aligned
- Small metadata: fontSize 9-10, color `#AABBCC`
- Math/equations: fontSize 20-24 for display math (`$$...$$`), at least 16 for inline math.

### MANDATORY Typography Rules
1. **Every content slide MUST have a title** as the first text element — fontSize 18, color `#1A2B48`, bold, positioned at (x:40, y:20)
2. **Title slides** use fontSize 36 for the main title
3. **Font sizes must be consistent** across all slides: title=18, body=12-14, subtitle=14, metadata=9-10
4. **Never skip the title** — even diagram-heavy or image-heavy slides need a title

## Layout Rules

- Top margin: y >= 18 for title area
- Side margins: x >= 40, content should not exceed x+w > 920
- Bottom margin: y+h < 510 (leave room for page numbers)
- Title positioned at top: y: 18-30
- Content starts below title: y: 55-80
- Spacing between sections: 30-50px
- Padding inside containers: 15-20px

## Design Principles

1. **White backgrounds only** — never use dark or colored slide backgrounds
2. **No filled bars or header blocks** — no colored rectangles behind titles
3. **No decorative shapes** — no ellipses, circles, or ornamental fills
4. **Lines to separate** — use 1px `#E7E6E6` rectangles as dividers
5. **Minimal fills** — containers use `#E7E6E6` (cards) or `#F2F2F2` (insight boxes only)
6. **Stroke-only cards** — use `stroke: "#E7E6E6"`, `strokeWidth: 1`
7. **No multi-line bold** — `**bold text**` must NOT contain `\n`

## Diagrams — Prefer Native Elements for Flow/Pipeline Diagrams

Build flow diagrams, flowcharts, pipelines, and block-and-arrow illustrations using shape + text + arrow elements.
Use TikZ only for complex technical diagrams (neural nets, math graphs, circuits) that are hard to build with shapes.

**Container boxes:**
- type: `"shape"`, shape: `"rectangle"`
- style: `{ fill: "#E7E6E6", stroke: "#E7E6E6", strokeWidth: 1, borderRadius: 6 }`
- Size: 120-300px wide, 40-60px tall

**Arrow connectors:**
- type: `"shape"`, shape: `"arrow"`
- style: `{ stroke: "#E7E6E6", strokeWidth: 2 }`
- CRITICAL positioning: arrow `position.x` = source box right edge, `position.y` = source box vertical center
- Size: `{ w: gap between boxes, h: 1 }` for horizontal arrows
- Waypoints are RELATIVE to the element position. For a horizontal arrow: `[{x:0,y:0},{x:W,y:0}]`
- For vertical arrows: `position.x` = box horizontal center, size: `{ w: 1, h: gap }`, waypoints: `[{x:0,y:0},{x:0,y:H}]`
- For L-shaped paths: use 3 waypoints `[{x:0,y:0},{x:W,y:0},{x:W,y:H}]`

**Text labels inside boxes:**
- Position and size matching the parent box
- style: `{ fontSize: 13, color: "#5B9BD5", textAlign: "center", verticalAlign: "middle" }`

**CRITICAL: Always group related elements:**
- Box + its label text must share the same `groupId`
- Arrow + its label must share the same `groupId`
- Convention: `groupId = "group-descriptive-name"`

## Animations

- Use `fadeIn` (300-400ms) for progressive content reveal
- Build slides step by step: container first (`onClick`), then content (`withPrevious`/`afterPrevious`)
- Use consistent trigger patterns across slides

## Slide Transitions

- Default: `{ type: "slide", duration: 300 }`
- Title/section slides: `{ type: "fade", duration: 500 }`

## TikZ for Complex Diagrams

Use TikZ elements for neural network architectures, mathematical diagrams, and other complex technical illustrations:
- Content: just the `tikzpicture` environment, no preamble
- Set `style: { backgroundColor: "#ffffff" }` to match slide background
- Use for: neural nets, attention mechanisms, mathematical graphs, signal flow diagrams

## Tables

- `headerBackground`: `"#E7E6E6"`
- `headerColor`: `"#1A2B48"`
- `borderColor`: `"#E7E6E6"`
- `fontSize`: 10-12
- `striped`: true
- `borderRadius`: 6
