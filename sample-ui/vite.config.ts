import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  cacheDir: ".vite-cache",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.1.0"),
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: parseInt(process.env.PORT || "4174", 10),
    strictPort: true,
    // Proxy to the local Ollama daemon so the browser doesn't need CORS
    // configuration on the Ollama side. Requests hit /api/ollama/... which
    // forwards to http://localhost:11434/... with the prefix stripped.
    proxy: {
      "/api/ollama": {
        target: "http://localhost:11434",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, "")
      },
      "/api": {
        target: "http://127.0.0.1:4180",
        changeOrigin: true
      }
    }
  }
});
