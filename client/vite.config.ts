import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { compression } from "vite-plugin-compression2";

function resolveApiProxy() {
  const backendUrl = process.env.MIMIMILLI_BACKEND_URL;
  if (!backendUrl) {
    throw new Error(
      "MIMIMILLI_BACKEND_URL が未設定です。pnpm dev など scripts/dev-client.mjs 経由で起動してください",
    );
  }
  const url = new URL(backendUrl);
  if (url.protocol !== "http:") {
    throw new Error(`MIMIMILLI_BACKEND_URL は http である必要があります: ${url.href}`);
  }

  return {
    target: `http://127.0.0.1${url.port ? `:${url.port}` : ""}`,
    headers: { host: url.hostname },
  };
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

  server: command === "serve" ? { proxy: { "/api": resolveApiProxy() } } : undefined,

  build: {
    // 4KB 未満の unicode-range 分割 woff2 が base64 インライン化され CSS が肥大化するため無効化
    assetsInlineLimit: 0,
  },
}));
