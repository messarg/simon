import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Consumed as TypeScript source so there is no build-ordering step, and so the
      // money rules exist exactly once (PRD §10.1).
      "@simon/shared": path.resolve(import.meta.dirname, "../packages/shared/src/index.ts"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // The API is same-origin in production (Nginx). In dev, proxy to the local
      // Express server — never hardcode a LAN IP anywhere in the client.
      "/api": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
});
