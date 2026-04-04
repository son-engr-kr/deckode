# Complete Example

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
