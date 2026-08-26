import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base` defaults to "/" for local dev and the self-hosted full-stack build.
// The GitHub Pages workflow sets VITE_BASE (e.g. "/testing/") so asset and
// demo-data URLs resolve under the project subpath.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:4410"
    }
  }
});
