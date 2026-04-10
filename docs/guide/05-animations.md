# Animations

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

**Available effects**: `fadeIn`, `fadeOut`, `slideInLeft`, `slideInRight`, `slideInUp`, `slideInDown`, `scaleIn`, `scaleOut`, `typewriter`, `scene3dStep`

`scene3dStep` is a special effect for `scene3d` elements only. It does not produce a CSS animation — it advances the scene to the next keyframe. Pair one `scene3dStep` animation per keyframe, with sequential `order` values.

## Animation Examples

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

