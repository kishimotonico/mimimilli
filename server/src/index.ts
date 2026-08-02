// エントリーポイント。Bun.serveで起動する。
// env:
//   PORT                    … 待受ポート（デフォルト 8080）
//   MIMIMILLI_ADAPTER       … "real"（デフォルト） | "fixture"（インメモリ開発データ）
//   MIMIMILLI_DATA_DIR       … DB・cache等のデータルート上書き
//   MIMIMILLI_DLSITE_CACHE_DB … DLsiteレスポンスキャッシュDBの絶対パス上書き
//   MIMIMILLI_DLSITE_OFFLINE … trueならDLsiteの実HTTPを遮断（既定 false）
//   MIMIMILLI_DLSITE_REQUEST_INTERVAL_MS / MIMIMILLI_DLSITE_RETRY_COUNT /
//   MIMIMILLI_DLSITE_MAX_BACKOFF_MS / MIMIMILLI_DLSITE_TIMEOUT_MS /
//   MIMIMILLI_DLSITE_USER_AGENT … DLsite実HTTPの制御設定
//   MIMIMILLI_THUMBNAIL_CACHE_DIR … カバーサムネイルのキャッシュ置き場
//                                   （デフォルト ./data/cache/thumbnails）
//   MIMIMILLI_MOCK_SCENARIO … fixture アダプタのデータシナリオ
//                             ("default" | "empty" | "new-work" | "errors"、省略時 "default")
import { resolve } from "node:path";
import { createApp } from "./app.ts";
import { createFixtureAdapter } from "./adapters/fixture/index.ts";
import { resolveDataPaths } from "./adapters/real/dataRoot.ts";
import { resolveDlsiteCacheConfig } from "./adapters/real/dlsiteCache.ts";
import { resolveDlsiteRequestConfig } from "./adapters/real/dlsiteConfig.ts";
import { createRealAdapter, type RealAdapter } from "./adapters/real/index.ts";
import type { DataAdapter } from "./adapter.ts";
import {
  createDlsiteEventLogger,
  dispose,
  formatError,
  getCategoryLogger,
  initLogger,
} from "./lib/logger.ts";

const adapterKind = process.env.MIMIMILLI_ADAPTER ?? "real";

initLogger(adapterKind === "real" ? { logDir: resolveDataPaths().logDir } : {});

function createAdapter(): DataAdapter {
  switch (adapterKind) {
    case "fixture":
      return createFixtureAdapter({ scenario: process.env.MIMIMILLI_MOCK_SCENARIO });
    case "real": {
      const paths = resolveDataPaths();
      return createRealAdapter({
        database: {
          kind: "files",
          catalogPath: paths.catalogDb,
          userPath: paths.userDb,
        },
        dataRoot: paths.root,
        dlsiteCache: resolveDlsiteCacheConfig(paths.dlsiteCacheDb),
        dlsiteRequestConfig: resolveDlsiteRequestConfig(),
        dlsiteSchedulerDependencies: { logger: createDlsiteEventLogger() },
        thumbnailCacheDir: process.env.MIMIMILLI_THUMBNAIL_CACHE_DIR
          ? resolve(process.env.MIMIMILLI_THUMBNAIL_CACHE_DIR)
          : paths.thumbnailCache,
      });
    }
    default:
      throw new Error(`不明な MIMIMILLI_ADAPTER です: ${adapterKind}`);
  }
}

const port = Number(process.env.PORT ?? 8080);
const adapter = createAdapter();
const app = createApp(adapter);

const server = Bun.serve({
  fetch: app.fetch,
  hostname: "127.0.0.1",
  port,
});

const serverLogger = getCategoryLogger("server");
serverLogger.info(
  `サーバーを起動しました: http://localhost:${server.port} (adapter: ${adapterKind})`,
);

let shuttingDown = false;

async function shutdown(exitCode: number, reason: string, error?: unknown): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    if (error) {
      serverLogger.fatal(reason, formatError(error));
    } else {
      serverLogger.info(reason);
    }
    if (isRealAdapter(adapter)) adapter.close();
    server.stop();
    await dispose();
  } catch (shutdownError) {
    console.error(shutdownError);
  } finally {
    process.exit(exitCode);
  }
}

function isRealAdapter(value: DataAdapter): value is RealAdapter {
  return "close" in value && typeof value.close === "function";
}

process.on("uncaughtException", (error) => {
  void shutdown(1, "未捕捉例外で終了します", error);
});

process.on("unhandledRejection", (reason) => {
  void shutdown(1, "未処理のPromise拒否で終了します", reason);
});

process.on("SIGINT", () => {
  void shutdown(0, "SIGINTを受信して終了します");
});

process.on("SIGTERM", () => {
  void shutdown(0, "SIGTERMを受信して終了します");
});
