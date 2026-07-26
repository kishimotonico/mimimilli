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
//   MIMIMILLI_DB            … 旧単一DBの明示パス（初回移行専用）
//   MIMIMILLI_THUMBNAIL_CACHE_DIR … カバーサムネイルのキャッシュ置き場
//                                   （デフォルト ./data/cache/thumbnails）
//   MIMIMILLI_MOCK_SCENARIO … fixture アダプタのデータシナリオ
//                             ("default" | "empty" | "new-work" | "errors"、省略時 "default")
import { resolve } from "node:path";
import { createApp } from "./app.ts";
import { createFixtureAdapter } from "./adapters/fixture/index.ts";
import { resolveDataPaths, resolveLegacyDbPath } from "./adapters/real/dataRoot.ts";
import { resolveDlsiteCacheConfig } from "./adapters/real/dlsiteCache.ts";
import { resolveDlsiteRequestConfig } from "./adapters/real/dlsiteConfig.ts";
import { createRealAdapter } from "./adapters/real/index.ts";
import type { DataAdapter } from "./adapter.ts";

const adapterKind = process.env.MIMIMILLI_ADAPTER ?? "real";
const dlsiteLogger = (event: Record<string, unknown>) => console.info(JSON.stringify(event));

function createAdapter(): DataAdapter {
  switch (adapterKind) {
    case "fixture":
      return createFixtureAdapter({ scenario: process.env.MIMIMILLI_MOCK_SCENARIO });
    case "real": {
      const paths = resolveDataPaths();
      const legacyPath = resolveLegacyDbPath();
      return createRealAdapter({
        database: {
          kind: "files",
          catalogPath: paths.catalogDb,
          userPath: paths.userDb,
          legacyPath: legacyPath ?? undefined,
        },
        dataRoot: paths.root,
        dlsiteCache: resolveDlsiteCacheConfig(paths.dlsiteCacheDb),
        dlsiteRequestConfig: resolveDlsiteRequestConfig(),
        dlsiteSchedulerDependencies: { logger: dlsiteLogger },
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
console.log(
  `mimimilli server listening on http://localhost:${server.port} (adapter: ${adapterKind})`,
);
