/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vitest/config";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { getRequestListener } from "@hono/node-server";
import type { ViteDevServer } from "vite";

// ---------------------------------------------------------------------------
// Vite 設定
// ---------------------------------------------------------------------------

// MIMIMILLI_BACKEND_SERVICE が設定されていれば同じ worktree の portless サービスへ
// プロキシし、なければ server の Hono アプリ（fixture アダプタ）を
// dev middleware としてマウントする。
const backendService = process.env.MIMIMILLI_BACKEND_SERVICE;
const serverSrcDir = fileURLToPath(new URL("../server/src", import.meta.url));
const sharedSrcDir = fileURLToPath(new URL("../shared/src", import.meta.url));
const fixtureApiWatchDirs = [serverSrcDir, sharedSrcDir];

type FixtureApiListener = ReturnType<typeof getRequestListener>;

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
    throw new Error(
      `real バックエンドの portless URL は http である必要があります: ${publicUrl.href}`,
    );
  }

  return {
    target: `http://127.0.0.1${publicUrl.port ? `:${publicUrl.port}` : ""}`,
    headers: { host: publicUrl.hostname },
  };
}

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
        const pathname = req.url ? new URL(req.url, "http://localhost").pathname : undefined;
        if (pathname !== "/api" && !pathname?.startsWith("/api/")) {
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
  plugins: [tailwindcss(), react(), !backendService && fixtureApiPlugin()].filter(Boolean),

  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.ts?(x)"],
    setupFiles: "./tests/unit/setup.ts",
  },

  server: {
    proxy: backendService ? { "/api": resolveBackendProxy(backendService) } : undefined,
  },

  ssr: {
    noExternal: ["@mimimilli/server", "@mimimilli/shared"],
  },

  build: {
    // 4KB 未満の unicode-range 分割 woff2 が base64 インライン化され CSS が肥大化するため無効化
    assetsInlineLimit: 0,
  },
});
