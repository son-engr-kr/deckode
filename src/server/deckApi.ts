import type { Plugin } from "vite";
import fs from "fs";
import path from "path";

const DECK_FILENAME = "deck.json";

/**
 * Vite plugin that exposes API endpoints for reading/writing deck.json.
 * Looks for deck.json in the project root (cwd).
 */
export function deckApiPlugin(): Plugin {
  const deckPath = () => path.resolve(process.cwd(), DECK_FILENAME);

  return {
    name: "deckode-api",
    configureServer(server) {
      server.middlewares.use("/api/load-deck", (_req, res) => {
        const filePath = deckPath();
        if (!fs.existsSync(filePath)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "deck.json not found" }));
          return;
        }
        const content = fs.readFileSync(filePath, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(content);
      });

      server.middlewares.use("/api/save-deck", (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        let body = "";
        req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        req.on("end", () => {
          // Validate it's valid JSON before writing
          JSON.parse(body);
          fs.writeFileSync(deckPath(), body, "utf-8");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        });
      });
    },
  };
}
