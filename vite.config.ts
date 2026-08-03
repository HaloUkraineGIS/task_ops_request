import { defineConfig } from "vite";

// IMPORTANT: this must exactly equal "/<REPO_NAME>/" (case-sensitive) or
// every built asset path will 404 once deployed to GitHub Pages.
// Replace REPO_NAME below with the actual new repository name.
const REPO_NAME = "task_ops_request";

export default defineConfig({
  base: `/${REPO_NAME}/`,
  build: {
    // gzip-size reporting on a multi-MB @arcgis/core bundle is expensive
    // and provides no value here — disable it.
    reportCompressedSize: false,
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
  server: {
    port: 5173,
  },
});
