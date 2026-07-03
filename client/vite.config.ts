/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { getRequestListener } from "@hono/node-server";
import { createApp } from "@mimimilli/server/app";
import { createFixtureAdapter } from "@mimimilli/server/adapters/fixture";

// ---------------------------------------------------------------------------
// Vite 設定
// ---------------------------------------------------------------------------

// BACKEND_URL が設定されていれば本物のサーバーにプロキシ、なければ
// server の Hono アプリ（fixture アダプタ）を dev middleware としてマウントする
// 例: BACKEND_URL=http://localhost:8080 pnpm dev
const backendUrl = process.env.BACKEND_URL;

/** server の Hono アプリ（fixture アダプタ）を dev middleware としてマウントする plugin */
function fixtureApiPlugin(): Plugin {
  const adapter = createFixtureAdapter({ scenario: process.env.MIMIMILLI_MOCK_SCENARIO });
  const app = createApp(adapter);
  const listener = getRequestListener(app.fetch);

  return {
    name: "fixture-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/")) {
          next();
          return;
        }
        void listener(req, res);
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    !backendUrl && fixtureApiPlugin(),
  ].filter(Boolean),

  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: "./tests/unit/setup.ts",
  },

  server: {
    proxy: backendUrl
      ? { "/api": { target: backendUrl, changeOrigin: true } }
      : undefined,
  },
});
