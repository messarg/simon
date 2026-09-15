import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Consumed as TypeScript source so there is no build-ordering step, and so the
      // money rules exist exactly once (PRD §10.1).
      "@simon/shared": path.resolve(import.meta.dirname, "../packages/shared/src/index.ts"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: true,
    proxy: {
      // The API is same-origin in production (Nginx). In dev, proxy to the local
      // Express server — never hardcode a LAN IP anywhere in the client. On macOS the
      // AirPlay Receiver holds :5000, so SIMON_API_URL points the proxy elsewhere.
      "/api": { target: process.env.SIMON_API_URL ?? "http://localhost:5000", changeOrigin: true },
    },
  },
});
