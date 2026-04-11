import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";
import { deckApiPlugin } from "./src/server/deckApi";

/**
 * Serve tikzjax .gz files as raw binary, bypassing sirv entirely.
 * sirv sets Content-Encoding: gzip for .gz files, causing the browser to
 * transparently decompress them. TikZJax's Worker expects raw .gz bytes
 * and decompresses via pako — double decompression causes Z_DATA_ERROR (-3).
 */
function tikzjaxGzFixPlugin(): Plugin {
  return {
    name: "tikzjax-gz-fix",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.includes("/tikzjax/") && req.url.endsWith(".gz")) {
          const filePath = path.join(__dirname, "public", req.url);
          if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath);
            res.writeHead(200, {
              "Content-Type": "application/octet-stream",
              "Content-Length": data.length,
              "Cache-Control": "no-cache",
            });
            res.end(data);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  // For GitHub Pages without a custom domain set VITE_BASE_PATH to "/tekkal/".
  // With tekkal.dev custom domain (set via public/CNAME), leave the default "/".
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [
    tikzjaxGzFixPlugin(),
    react(),
    tailwindcss(),
    // Only load the Vite dev server API plugin during dev
    ...(command === "serve" ? [deckApiPlugin()] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    cors: true,
    watch: {
      ignored: [
        path.resolve(__dirname, "projects/**"),
      ],
    },
  },
  test: {
    globals: true,
    environment: "node",
    exclude: ["tests/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      // Coverage targets the business-logic layer: AI pipeline, stores,
      // utils, types. UI components (editor/presenter/renderer), React
      // hooks and contexts, adapters, and the server plugin are excluded
      // because they require heavy browser or HTTP mocking to unit-test
      // and are instead covered by manual / visual-regression checks.
      include: [
        "src/ai/**/*.ts",
        "src/stores/**/*.ts",
        "src/utils/**/*.ts",
        "src/types/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        // Legacy / dead code that is intentionally untested
        "src/utils/tikzjax.ts",
        "src/utils/videoParser.ts",
        "src/utils/rasterize.ts",
        "src/utils/componentLoader.ts",
        "src/utils/crossInstanceAssets.ts",
      ],
      // Baseline thresholds — CI fails if coverage regresses below these.
      // Raise incrementally as the test suite grows. The numbers reflect
      // current post-Phase-4 coverage minus a small safety margin so that
      // unrelated refactors do not accidentally trip the gate.
      thresholds: {
        statements: 52,
        branches: 50,
        functions: 44,
        lines: 53,
      },
    },
  },
}));
