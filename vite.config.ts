/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { mockApiPlugin } from "./mocks/devServer";

// ---------------------------------------------------------------------------
// Vite 設定
// ---------------------------------------------------------------------------

// BACKEND_URL が設定されていれば本物のサーバーにプロキシ、なければモックを使う
// 例: BACKEND_URL=http://localhost:8080 pnpm dev
const backendUrl = process.env.BACKEND_URL;

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    !backendUrl && mockApiPlugin(),
  ].filter(Boolean),

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },

  server: {
    proxy: backendUrl
      ? { "/api": { target: backendUrl, changeOrigin: true } }
      : undefined,
  },
});
