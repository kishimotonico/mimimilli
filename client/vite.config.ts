/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { getRequestListener } from "@hono/node-server";
import type { ViteDevServer } from "vite";

// ---------------------------------------------------------------------------
// Vite 設定
// ---------------------------------------------------------------------------

// BACKEND_URL が設定されていれば本物のサーバーにプロキシ、なければ
// server の Hono アプリ（fixture アダプタ）を dev middleware としてマウントする
// 例: BACKEND_URL=http://localhost:8080 pnpm dev
const backendUrl = process.env.BACKEND_URL;
const serverSrcDir = fileURLToPath(new URL("../server/src", import.meta.url));
const sharedSrcDir = fileURLToPath(new URL("../shared/src", import.meta.url));
const fixtureApiWatchDirs = [serverSrcDir, sharedSrcDir];

type FixtureApiListener = ReturnType<typeof getRequestListener>;

function toViteFsUrl(filePath: string): string {
  return `/@fs/${filePath.split(path.sep).join("/")}`;
}

function isFixtureApiSource(filePath: string): boolean {
  const absoluteFilePath = path.resolve(filePath);
  return fixtureApiWatchDirs.some((dir) => {
    const relative = path.relative(dir, absoluteFilePath);
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
  });
}

/** server の Hono アプリ（fixture アダプタ）を dev middleware としてマウントする plugin */
function fixtureApiPlugin(): Plugin {
  let listenerPromise: Promise<FixtureApiListener> | null = null;

  async function loadListener(server: ViteDevServer): Promise<FixtureApiListener> {
    const [{ createApp }, { createFixtureAdapter }] = await Promise.all([
      server.ssrLoadModule(toViteFsUrl(path.join(serverSrcDir, "app.ts"))) as Promise<
        typeof import("@mimimilli/server/app")
      >,
      server.ssrLoadModule(
        toViteFsUrl(path.join(serverSrcDir, "adapters/fixture/index.ts")),
      ) as Promise<typeof import("@mimimilli/server/adapters/fixture")>,
    ]);
    const adapter = createFixtureAdapter({ scenario: process.env.MIMIMILLI_MOCK_SCENARIO });
    const app = createApp(adapter);
    return getRequestListener(app.fetch);
  }

  function getListener(server: ViteDevServer): Promise<FixtureApiListener> {
    listenerPromise ??= loadListener(server).catch((error: unknown) => {
      listenerPromise = null;
      throw error;
    });
    return listenerPromise;
  }

  function invalidateFixtureApi(server: ViteDevServer, filePath: string): void {
    const modules = server.moduleGraph.getModulesByFile(filePath);
    if (modules) {
      for (const mod of modules) {
        server.moduleGraph.invalidateModule(mod);
      }
    }
    listenerPromise = null;
  }

  return {
    name: "fixture-api",
    configureServer(server) {
      // client 外の workspace package は Vite の通常 HMR 対象から外れやすい。
      // fixture API は ssrLoadModule 経由で読み、server/shared の変更時に
      // 対応する SSR module graph を無効化して次の /api リクエストで作り直す。
      server.watcher.add(fixtureApiWatchDirs);
      server.watcher.on("all", (event, filePath) => {
        if (!["add", "change", "unlink"].includes(event) || !isFixtureApiSource(filePath)) {
          return;
        }
        invalidateFixtureApi(server, path.resolve(filePath));
        if (event === "unlink") {
          server.moduleGraph.onFileDelete(filePath);
        }
      });

      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/")) {
          next();
          return;
        }
        void getListener(server)
          .then((listener) => listener(req, res))
          .catch((error: Error) => {
            server.ssrFixStacktrace(error);
            next(error);
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), !backendUrl && fixtureApiPlugin()].filter(Boolean),

  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: "./tests/unit/setup.ts",
  },

  server: {
    proxy: backendUrl ? { "/api": { target: backendUrl, changeOrigin: true } } : undefined,
  },

  ssr: {
    noExternal: ["@mimimilli/server", "@mimimilli/shared"],
  },
});
