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
//   MIMIMILLI_STATIC_DIR    … client/dist 等の静的配信ルート（未設定ならAPIのみ）
import { resolve } from "node:path";
import { createFixtureAdapter } from "./adapters/fixture/index.ts";
import { resolveDataPaths } from "./adapters/real/dataRoot.ts";
import { resolveDlsiteCacheConfig } from "./adapters/real/dlsiteCache.ts";
import { resolveDlsiteRequestConfig } from "./adapters/real/dlsiteConfig.ts";
import { createRealAdapter } from "./adapters/real/index.ts";
import type { DataAdapter } from "./adapter/index.ts";
import {
  createDlsiteEventLogger,
  formatError,
  getCategoryLogger,
  initLogger,
} from "./lib/logger.ts";
import {
  createUnhandledRejectionReporter,
  registerProcessErrorHandlers,
} from "./lib/processErrorHandlers.ts";
import { performGracefulShutdown, runCleanupAndExit } from "./serverLifecycle.ts";
import { serveMimimilli } from "./serve.ts";
import { resolveStaticDir } from "./staticServe.ts";
import { buildStartupLogProperties } from "./lib/startupLog.ts";

const adapterKind = process.env.MIMIMILLI_ADAPTER ?? "real";
const dataPaths = adapterKind === "real" ? resolveDataPaths() : undefined;
const { logFilePath } = await initLogger(dataPaths ? { logDir: dataPaths.logDir } : {});

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

let shuttingDown = false;
let adapter: DataAdapter | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
let app: ReturnType<typeof serveMimimilli>["app"] | undefined;

const reportUnhandledRejection = createUnhandledRejectionReporter((message, properties) => {
  serverLogger.error(message, properties);
});

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

  await runCleanupAndExit(() => performGracefulShutdown({ server, app, adapter }), exitCode);
}

registerProcessErrorHandlers({
  target: process,
  onUnhandledRejection: reportUnhandledRejection,
  onUncaughtException: (error) => {
    void shutdown(1, "未捕捉例外で終了します", error);
  },
  onSignal: (signal) => {
    void shutdown(
      0,
      signal === "SIGINT" ? "SIGINTを受信して終了します" : "SIGTERMを受信して終了します",
    );
  },
});

const port = Number(process.env.PORT ?? 8080);
const staticDir = resolveStaticDir(process.env.MIMIMILLI_STATIC_DIR);

adapter = createAdapter();
const served = serveMimimilli({ adapter, port, appOptions: { staticDir } });
app = served.app;
server = served.server;

serverLogger.info(
  `サーバーを起動しました: http://localhost:${server.port} (adapter: ${adapterKind})`,
  buildStartupLogProperties({
    adapterKind,
    dataPaths,
    logFilePath,
    scenario: process.env.MIMIMILLI_MOCK_SCENARIO,
  }),
);
