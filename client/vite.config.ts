/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { execFileSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { compression } from "vite-plugin-compression2";

function resolveBackendProxy(service: string) {
  // Windows の portless は node_modules/.bin のバッチシム（.CMD）なので shell 経由が必須。
  // 引数は静的な文字列のみのため shell 経由でもエスケープの懸念はない。
  const publicUrl = new URL(
    execFileSync("portless", ["get", service], {
      encoding: "utf8",
      shell: process.platform === "win32",
    }).trim(),
  );
  if (publicUrl.protocol !== "http:") {
    throw new Error(`バックエンドの portless URL は http である必要があります: ${publicUrl.href}`);
  }

  return {
    target: `http://127.0.0.1${publicUrl.port ? `:${publicUrl.port}` : ""}`,
    headers: { host: publicUrl.hostname },
  };
}

function resolveApiProxy() {
  const backendUrl = process.env.MIMIMILLI_BACKEND_URL;
  if (backendUrl) {
    return { target: backendUrl };
  }
  const backendService = process.env.MIMIMILLI_BACKEND_SERVICE ?? "api.mimi";
  return resolveBackendProxy(backendService);
}

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    react(),
    compression({
      include: [/\.(js|mjs|css|html|svg|json)$/],
      exclude: [/\.(png|jpe?g|gif|webp|woff2?|ico)$/],
      algorithms: ["gzip", "brotliCompress"],
    }),
  ],

  test: {
    environment: "happy-dom",
    pool: "threads",
    globals: true,
    include: ["tests/unit/**/*.test.ts?(x)"],
    setupFiles: "./tests/unit/setup.ts",
  },

  server: command === "serve" ? { proxy: { "/api": resolveApiProxy() } } : undefined,

  build: {
    // 4KB 未満の unicode-range 分割 woff2 が base64 インライン化され CSS が肥大化するため無効化
    assetsInlineLimit: 0,
  },
}));
