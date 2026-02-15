import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import Ajv2020 from "ajv/dist/2020";

const DECK_FILENAME = "deck.json";

function loadSchema() {
  const schemaPath = path.resolve(process.cwd(), "src/schema/deck.schema.json");
  return JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
}

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true });
  return ajv.compile(loadSchema());
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
  });
}

function jsonResponse(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/**
 * Vite plugin that exposes API endpoints for deck.json operations.
 *
 * Editor endpoints:
 *   GET  /api/load-deck    — Read deck.json
 *   POST /api/save-deck    — Write deck.json (full replacement)
 *
 * AI tool endpoints:
 *   POST /api/ai/create-deck     — Create a new deck (validates against schema)
 *   POST /api/ai/add-slide       — Add a slide to the deck
 *   POST /api/ai/update-slide    — Update a slide by ID
 *   POST /api/ai/delete-slide    — Delete a slide by ID
 *   POST /api/ai/add-element     — Add an element to a slide
 *   POST /api/ai/update-element  — Update an element within a slide
 *   POST /api/ai/delete-element  — Delete an element from a slide
 *   GET  /api/ai/read-deck       — Read the current deck state
 *   GET  /api/ai/tools           — List available AI tools with schemas
 */
export function deckApiPlugin(): Plugin {
  const deckPath = () => path.resolve(process.cwd(), DECK_FILENAME);
  let validate: ReturnType<typeof createValidator>;
  let viteServer: Parameters<NonNullable<Plugin["configureServer"]>>[0];

  /** Notify the browser that deck.json was modified by an AI tool */
  function notifyDeckChanged() {
    viteServer.ws.send({ type: "custom", event: "deckode:deck-changed" });
  }

  return {
    name: "deckode-api",
    configureServer(server) {
      viteServer = server;
      validate = createValidator();

      // -- Editor endpoints --

      server.middlewares.use("/api/load-deck", (_req, res) => {
        const filePath = deckPath();
        if (!fs.existsSync(filePath)) {
          jsonResponse(res, 404, { error: "deck.json not found" });
          return;
        }
        const content = fs.readFileSync(filePath, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(content);
      });

      server.middlewares.use("/api/save-deck", async (req, res) => {
        if (req.method !== "POST") {
          jsonResponse(res, 405, { error: "Method not allowed" });
          return;
        }
        const body = await readBody(req);
        JSON.parse(body); // crash on invalid JSON (fail-fast)
        fs.writeFileSync(deckPath(), body, "utf-8");
        jsonResponse(res, 200, { ok: true });
      });

      // -- AI tool: read-deck --

      server.middlewares.use("/api/ai/read-deck", (_req, res) => {
        const deck = loadDeck(deckPath());
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        jsonResponse(res, 200, deck);
      });

      // -- AI tool: list tools --

      server.middlewares.use("/api/ai/tools", (_req, res) => {
        jsonResponse(res, 200, AI_TOOLS_MANIFEST);
      });

      // -- AI tool: create-deck --

      server.middlewares.use("/api/ai/create-deck", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const body = await readBody(req);
        const deck = JSON.parse(body);
        const valid = validate(deck);
        if (!valid) {
          jsonResponse(res, 400, { error: "Schema validation failed", details: validate.errors });
          return;
        }
        fs.writeFileSync(deckPath(), JSON.stringify(deck, null, 2), "utf-8");
        notifyDeckChanged();
        jsonResponse(res, 200, { ok: true, slides: deck.slides.length });
      });

      // -- AI tool: add-slide --

      server.middlewares.use("/api/ai/add-slide", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const deck = loadDeck(deckPath());
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slide, afterSlideId } = JSON.parse(await readBody(req));
        assert(slide && typeof slide === "object" && slide.id, "Missing slide object with id");
        assert(Array.isArray(slide.elements), "slide.elements must be an array");

        if (afterSlideId) {
          const idx = deck.slides.findIndex((s: any) => s.id === afterSlideId);
          assert(idx !== -1, `Slide ${afterSlideId} not found`);
          deck.slides.splice(idx + 1, 0, slide);
        } else {
          deck.slides.push(slide);
        }
        saveDeck(deckPath(), deck);
        notifyDeckChanged();
        jsonResponse(res, 200, { ok: true, slideId: slide.id, totalSlides: deck.slides.length });
      });

      // -- AI tool: update-slide --

      server.middlewares.use("/api/ai/update-slide", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const deck = loadDeck(deckPath());
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slideId, patch } = JSON.parse(await readBody(req));
        assert(typeof slideId === "string", "Missing slideId");
        assert(patch && typeof patch === "object", "Missing patch object");
        const slide = deck.slides.find((s: any) => s.id === slideId);
        assert(slide, `Slide ${slideId} not found`);
        Object.assign(slide, patch, { id: slideId }); // preserve id
        saveDeck(deckPath(), deck);
        notifyDeckChanged();
        jsonResponse(res, 200, { ok: true, slideId });
      });

      // -- AI tool: delete-slide --

      server.middlewares.use("/api/ai/delete-slide", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const deck = loadDeck(deckPath());
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slideId } = JSON.parse(await readBody(req));
        assert(typeof slideId === "string", "Missing slideId");
        const idx = deck.slides.findIndex((s: any) => s.id === slideId);
        assert(idx !== -1, `Slide ${slideId} not found`);
        deck.slides.splice(idx, 1);
        saveDeck(deckPath(), deck);
        notifyDeckChanged();
        jsonResponse(res, 200, { ok: true, remaining: deck.slides.length });
      });

      // -- AI tool: add-element --

      server.middlewares.use("/api/ai/add-element", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const deck = loadDeck(deckPath());
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slideId, element } = JSON.parse(await readBody(req));
        assert(typeof slideId === "string", "Missing slideId");
        assert(element && typeof element === "object" && element.id, "Missing element object with id");
        const slide = deck.slides.find((s: any) => s.id === slideId);
        assert(slide, `Slide ${slideId} not found`);
        slide.elements.push(element);
        saveDeck(deckPath(), deck);
        notifyDeckChanged();
        jsonResponse(res, 200, { ok: true, slideId, elementId: element.id, totalElements: slide.elements.length });
      });

      // -- AI tool: update-element --

      server.middlewares.use("/api/ai/update-element", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const deck = loadDeck(deckPath());
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slideId, elementId, patch } = JSON.parse(await readBody(req));
        assert(typeof slideId === "string", "Missing slideId");
        assert(typeof elementId === "string", "Missing elementId");
        assert(patch && typeof patch === "object", "Missing patch object");
        const slide = deck.slides.find((s: any) => s.id === slideId);
        assert(slide, `Slide ${slideId} not found`);
        const element = slide.elements.find((e: any) => e.id === elementId);
        assert(element, `Element ${elementId} not found in slide ${slideId}`);
        Object.assign(element, patch, { id: elementId }); // preserve id
        saveDeck(deckPath(), deck);
        notifyDeckChanged();
        jsonResponse(res, 200, { ok: true, slideId, elementId });
      });

      // -- AI tool: delete-element --

      server.middlewares.use("/api/ai/delete-element", async (req, res) => {
        if (req.method !== "POST") { jsonResponse(res, 405, { error: "POST only" }); return; }
        const deck = loadDeck(deckPath());
        if (!deck) { jsonResponse(res, 404, { error: "No deck.json found" }); return; }
        const { slideId, elementId } = JSON.parse(await readBody(req));
        assert(typeof slideId === "string", "Missing slideId");
        assert(typeof elementId === "string", "Missing elementId");
        const slide = deck.slides.find((s: any) => s.id === slideId);
        assert(slide, `Slide ${slideId} not found`);
        const idx = slide.elements.findIndex((e: any) => e.id === elementId);
        assert(idx !== -1, `Element ${elementId} not found in slide ${slideId}`);
        slide.elements.splice(idx, 1);
        saveDeck(deckPath(), deck);
        notifyDeckChanged();
        jsonResponse(res, 200, { ok: true, slideId, remaining: slide.elements.length });
      });
    },
  };
}

// -- Helpers --

function loadDeck(filePath: string): any | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveDeck(filePath: string, deck: any) {
  fs.writeFileSync(filePath, JSON.stringify(deck, null, 2), "utf-8");
}

function assert(condition: any, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// -- AI Tools Manifest --

const AI_TOOLS_MANIFEST = {
  name: "deckode",
  description: "AI tools for creating and modifying Deckode slide decks",
  guide: "/docs/ai-slide-guide.md",
  schema: "/src/schema/deck.schema.json",
  tools: [
    {
      name: "create-deck",
      method: "POST",
      endpoint: "/api/ai/create-deck",
      description: "Create a new deck. Body: full deck.json object. Validates against schema.",
      body: "Deck (full deck.json)",
    },
    {
      name: "add-slide",
      method: "POST",
      endpoint: "/api/ai/add-slide",
      description: "Add a slide to the deck.",
      body: '{ "slide": Slide, "afterSlideId"?: string }',
    },
    {
      name: "update-slide",
      method: "POST",
      endpoint: "/api/ai/update-slide",
      description: "Update a slide by ID (partial patch).",
      body: '{ "slideId": string, "patch": Partial<Slide> }',
    },
    {
      name: "delete-slide",
      method: "POST",
      endpoint: "/api/ai/delete-slide",
      description: "Delete a slide by ID.",
      body: '{ "slideId": string }',
    },
    {
      name: "add-element",
      method: "POST",
      endpoint: "/api/ai/add-element",
      description: "Add an element to a slide.",
      body: '{ "slideId": string, "element": Element }',
    },
    {
      name: "update-element",
      method: "POST",
      endpoint: "/api/ai/update-element",
      description: "Update an element within a slide (partial patch).",
      body: '{ "slideId": string, "elementId": string, "patch": Partial<Element> }',
    },
    {
      name: "delete-element",
      method: "POST",
      endpoint: "/api/ai/delete-element",
      description: "Delete an element from a slide.",
      body: '{ "slideId": string, "elementId": string }',
    },
    {
      name: "read-deck",
      method: "GET",
      endpoint: "/api/ai/read-deck",
      description: "Read the current deck state. Returns the full deck.json object.",
      body: null,
    },
  ],
};
