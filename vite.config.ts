import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        // API target is configurable so the backend can dodge reserved ports
        // (e.g. macOS occupies 5000 with AirPlay ControlCenter). Both sides
        // read API_PORT so the proxy always follows the server.
        target: `http://localhost:${process.env.API_PORT || 5001}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendor libraries so the core app bundle stays lean and
        // caches independently of chart/map/PDF code.
        // NO_VENDOR_CHUNKS=1 opts out (scripts/build-preview.cjs needs a single
        // self-contained chunk to inline into preview.html).
        manualChunks: process.env.NO_VENDOR_CHUNKS
          ? undefined
          : {
          "vendor-react": ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          "vendor-charts": ["recharts"],
          "vendor-maps": ["leaflet", "react-leaflet"],
          "vendor-tickets": ["jspdf", "qrcode"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
