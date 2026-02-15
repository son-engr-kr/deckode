import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { deckApiPlugin } from "./src/server/deckApi";

export default defineConfig({
  plugins: [react(), tailwindcss(), deckApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    watch: {
      ignored: [path.resolve(__dirname, "deck.json")],
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
