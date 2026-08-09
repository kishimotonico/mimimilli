// real アダプタ: SQLite（キャッシュ）+ 実ファイルシステム + `mimimilli.json`（Source of Truth）。
// 作品検索・件数・ページングはcatalog接続からuser DBをATTACH JOINしてSQLで実行する。
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { DataAdapter } from "../../adapter.ts";
import { openDb, type Db, type DbLocation } from "./db.ts";
import { DlsiteCache, type DlsiteCacheOptions } from "./dlsiteCache.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG, type DlsiteRequestConfig } from "./dlsiteConfig.ts";
import { DlsiteScheduler, type DlsiteSchedulerDependencies } from "./dlsiteScheduler.ts";
import { Scanner } from "./scanner.ts";
import {
  measureCoverDimensions,
  ThumbnailCache,
  type ThumbnailCacheOptions,
} from "./thumbnailCache.ts";
import { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import { WorkQueryRepository } from "./workQueryRepository.ts";
import { createDlsiteMethods } from "./dlsiteMethods.ts";
import { createCoverMediaMethods } from "./coverMediaMethods.ts";
import { createSettingsScanMethods } from "./settingsScanMethods.ts";
import { createWorkMethods } from "./workMethods.ts";
import { createClassificationMethods, initializeTagPrefixes } from "./classificationMethods.ts";
import { runFileScanInWorker, type FileScanRunner } from "./scanRunner.ts";

export interface RealAdapterOptions {
  database: DbLocation;
  /** カバーサムネイルのキャッシュ置き場。ファイルDBの通常起動ではデータルート配下を渡す。 */
  thumbnailCacheDir?: string;
  /** サムネイル変換の同時実行数・変換関数（テスト用）を注入する。 */
  thumbnailCache?: ThumbnailCacheOptions;
  /** manifestとバックアップを保存するデータルート。 */
  dataRoot?: string;
  /** DBバックアップ退避先。ファイルDBの通常起動ではデータルート配下を渡す。 */
  dbBackupDir?: string;
  /** DLsiteの実HTTP設定。環境変数の解決はserver/src/index.tsだけで行う。 */
  dlsiteRequestConfig?: DlsiteRequestConfig;
  /** schedulerのtransport/clock/sleep/random/logger注入。実ネットワークなしの試験用。 */
  dlsiteSchedulerDependencies?: DlsiteSchedulerDependencies;
  /** DLsiteレスポンスキャッシュ。 */
  dlsiteCache: DlsiteCacheOptions;
}

export interface RealAdapterAssembly {
  runFileScanInWorker?: FileScanRunner;
}

export interface RealAdapter extends DataAdapter {
  close(): void;
}

export function createRealAdapter(
  options: RealAdapterOptions,
  assembly: RealAdapterAssembly = {},
): RealAdapter {
  const db: Db = openDb(
    options.database,
    options.dbBackupDir === undefined ? undefined : { backupDir: options.dbBackupDir },
  );
  const dlsiteCache = new DlsiteCache(options.dlsiteCache);
  const query = new WorkQueryRepository(db);
  const catalog = new CatalogWorkRepository(db);
  const user = new UserWorkStateRepository(db);
  const thumbnailCacheDir = options.thumbnailCacheDir ?? join(tmpdir(), "mimimilli-memory-cache");
  const thumbnailCache = new ThumbnailCache(options.thumbnailCache);
  const dataRoot =
    options.dataRoot ??
    (options.database.kind === "files"
      ? dirname(dirname(options.database.catalogPath))
      : join(tmpdir(), "mimimilli-memory-data"));
  const scanner = new Scanner(
    db,
    { query, catalog, user },
    { measureCover: measureCoverDimensions },
  );
  const dlsiteRequestConfig: DlsiteRequestConfig = {
    ...DEFAULT_DLSITE_REQUEST_CONFIG,
    ...options.dlsiteRequestConfig,
  };
  const dlsiteScheduler = new DlsiteScheduler(
    dlsiteRequestConfig,
    options.dlsiteSchedulerDependencies,
  );
  initializeTagPrefixes(user);

  const { cachedCover, ...dlsiteMethods } = createDlsiteMethods({
    db,
    query,
    catalog,
    dlsiteCache,
    dlsiteCacheOptions: options.dlsiteCache,
    dlsiteRequestConfig,
    dlsiteScheduler,
    schedulerDependencies: options.dlsiteSchedulerDependencies,
  });
  const { requireRoot, ...settingsScanMethods } = createSettingsScanMethods({
    database: options.database,
    query,
    catalog,
    user,
    scanner,
    dataRoot,
    thumbnailCacheDir,
    runFileScanInWorker: assembly.runFileScanInWorker ?? runFileScanInWorker,
  });
  const coverMediaMethods = createCoverMediaMethods({
    query,
    thumbnailCache,
    thumbnailCacheDir,
    requireRoot,
  });
  const workMethods = createWorkMethods({
    db,
    query,
    catalog,
    user,
    scanner,
    requireRoot,
    cachedCover,
  });
  const classificationMethods = createClassificationMethods({ query, user });

  return {
    ...settingsScanMethods,
    ...workMethods,
    ...classificationMethods,
    ...coverMediaMethods,
    ...dlsiteMethods,
    close(): void {
      dlsiteCache.close();
      db.close();
    },
  };
}
