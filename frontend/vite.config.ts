import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installed on a shop phone, the till opens from the home screen and starts without the network:
    // the shell is precached and everything else already works offline (§14.4, §18).
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png"],
      manifest: {
        name: "Սիմոն",
        short_name: "Սիմոն",
        description: "Խանութի վաճառքի և պահեստի համակարգ",
        lang: "hy",
        dir: "ltr",
        start_url: "/sell",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f7f4ee",
        theme_color: "#1f6b6b",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The shell only. Data has its own cache (IndexedDB) and its own queue: a service worker
        // answering an API call from a cache would be a second, silent source of truth (§14.4).
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
