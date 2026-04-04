# Slide File Splitting (`$ref`)

When a deck grows large, individual slides can be split into separate files under `slides/`. A slide entry in the `slides` array can be either an inline slide object or a `$ref` pointer to an external file:

```json
{
  "slides": [
    { "id": "slide-1", "elements": [...] },
    { "$ref": "./slides/intro.json" },
    { "id": "slide-3", "elements": [...] }
  ]
}
```

The external file is a plain Slide JSON object (same schema as inline):

```json
{
  "id": "intro",
  "elements": [...],
  "animations": [...]
}
```

**How it works:**

- On load, `$ref` entries are resolved by reading the referenced file. The resolved slide receives a `_ref` field tracking its origin path.
- On save, slides with `_ref` are written back to their external file and replaced with `{ "$ref": "..." }` in deck.json.
- The editor, store, and renderers are unaware of the split — they see a flat array of resolved slides.
- New slides added via the editor are automatically externalized (saved to `./slides/{slideId}.json`).

**AI tools:**

- `extract-slide` — moves an inline slide to `./slides/{slideId}.json` and replaces it with a `$ref` pointer.
- `inline-slide` — brings an external `$ref` slide back inline into deck.json and deletes the external file.

**Convention:** use `./slides/` as the directory for external slide files. Use the slide `id` as the filename (e.g., `./slides/intro.json`).

