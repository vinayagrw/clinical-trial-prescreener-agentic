import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load .env.local / .env — ANTHROPIC_API_KEY is injected server-side by the
  // dev proxy so the key never reaches the browser.
  const env = loadEnv(mode, process.cwd(), "");
  const anthropicKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

  return {
    cacheDir: ".vite-cache",
    plugins: [react()],
    resolve: {
      alias: {
        "@old": path.resolve(__dirname, "../sample-ui/src"),
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 4175,
      proxy: {
        // Browser calls POST /api/claude; dev proxy rewrites to Anthropic
        // Messages API and injects the API key server-side.
        "/api/claude": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/claude/, "/v1/messages"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (anthropicKey) {
                proxyReq.setHeader("x-api-key", anthropicKey);
                proxyReq.setHeader("anthropic-version", "2023-06-01");
              }
              proxyReq.setHeader("content-type", "application/json");
            });
          },
        },
      },
    },
  };
});
