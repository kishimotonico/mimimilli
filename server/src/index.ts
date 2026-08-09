// エントリーポイント。Bun.serveで起動する。
// env:
//   PORT                    … 待受ポート（デフォルト 8080）
//   MIMIMILLI_ADAPTER       … "real"（デフォルト） | "fixture"（インメモリ開発データ）
//   MIMIMILLI_DATA_DIR       … DB・cache等のデータルート上書き
//   MIMIMILLI_DLSITE_CACHE_DB … DLsiteレスポンスキャッシュDBの絶対パス上書き
//   MIMIMILLI_DLSITE_OFFLINE … trueならDLsiteの実HTTPを遮断（既定 false）
//   MIMIMILLI_DLSITE_REQUEST_INTERVAL_MS … DLsite実HTTPの開始間隔（既定 1000ms）
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
import type { DataAdapter } from "./adapter/index.ts";
import {
  createDlsiteEventLogger,
  dispose,
  formatError,
  getCategoryLogger,
  initLogger,
} from "./lib/logger.ts";
import { buildStartupLogProperties } from "./lib/startupLog.ts";

const adapterKind = process.env.MIMIMILLI_ADAPTER ?? "real";
const dataPaths = adapterKind === "real" ? resolveDataPaths() : undefined;
const { logFilePath } = initLogger(dataPaths ? { logDir: dataPaths.logDir } : {});

const serverLogger = getCategoryLogger("server");

function createAdapter(): DataAdapter {
  switch (adapterKind) {
    case "fixture":
      return createFixtureAdapter({ scenario: process.env.MIMIMILLI_MOCK_SCENARIO });
    case "real": {
      if (!dataPaths) {
        throw new Error("real adapter requires dataPaths");
      }
      return createRealAdapter({
        database: {
          kind: "files",
          catalogPath: dataPaths.catalogDb,
          userPath: dataPaths.userDb,
        },
        dbBackupDir: dataPaths.backupDir,
        dataRoot: dataPaths.root,
        dlsiteCache: resolveDlsiteCacheConfig(dataPaths.dlsiteCacheDb),
        dlsiteRequestConfig: resolveDlsiteRequestConfig(),
        dlsiteSchedulerDependencies: { logger: createDlsiteEventLogger() },
        thumbnailCacheDir: process.env.MIMIMILLI_THUMBNAIL_CACHE_DIR
          ? resolve(process.env.MIMIMILLI_THUMBNAIL_CACHE_DIR)
          : dataPaths.thumbnailCache,
      });
    }
    default:
      throw new Error(`不明な MIMIMILLI_ADAPTER です: ${adapterKind}`);
  }
}

function isRealAdapter(value: DataAdapter): value is RealAdapter {
  return "close" in value && typeof value.close === "function";
}

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
  } catch (logError) {
    console.error(logError);
  }

  try {
    if (adapter && isRealAdapter(adapter)) adapter.close();
  } catch (closeError) {
    console.error(closeError);
  }

  try {
    if (server) server.stop();
  } catch (stopError) {
    console.error(stopError);
  }

  try {
    await dispose();
  } catch (disposeError) {
    console.error(disposeError);
  }

  process.exit(exitCode);
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

const port = Number(process.env.PORT ?? 8080);
/** DLsite同期fetchの総期限(60s)+余裕。Bun既定の10sアイドル制限を上書きする。 */
const SERVER_IDLE_TIMEOUT_SECONDS = 90;
let adapter: DataAdapter | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;

adapter = createAdapter();
const app = createApp(adapter);

server = Bun.serve({
  fetch: app.fetch,
  hostname: "127.0.0.1",
  port,
  idleTimeout: SERVER_IDLE_TIMEOUT_SECONDS,
});

serverLogger.info(
  `サーバーを起動しました: http://localhost:${server.port} (adapter: ${adapterKind})`,
  buildStartupLogProperties({
    adapterKind,
    dataPaths,
    logFilePath,
    scenario: process.env.MIMIMILLI_MOCK_SCENARIO,
  }),
);
