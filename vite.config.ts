import { defineConfig } from "vite";

export default defineConfig({
  // Card artwork lives in card-svgs/ (feature 015) and is served as-is —
  // e.g. card-svgs/AS.svg becomes /AS.svg — rather than duplicated into a
  // conventional public/ directory.
  publicDir: "card-svgs",
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
  build: {
    outDir: "dist/client",
  },
});
