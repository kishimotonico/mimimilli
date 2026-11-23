// real アダプタ: SQLite（キャッシュ）+ 実ファイルシステム + `mimimilli.json`（Source of Truth）。
// 作品検索・件数・ページングはcatalog接続からuser DBをATTACH JOINしてSQLで実行する。
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DataAdapter } from "../../adapter/index.ts";
import { openDb, type Db, type DbLocation } from "./db.ts";
import { DLSITE_PARSER, type DlsiteParser } from "./dlsite.ts";
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
import { createSmartFolderMethods, initializeSmartFolders } from "./smartFolderMethods.ts";
import { createTagPrefixMethods, initializeTagPrefixes } from "./tagPrefixMethods.ts";
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
  /** DLsite作品ページの解析。省略時は現在のパーサー */
  dlsiteParser?: DlsiteParser;
}

export interface RealAdapterAssembly {
  runFileScanInWorker?: FileScanRunner;
}

export interface RealAdapter extends DataAdapter {
  close(): Promise<void>;
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
  const parser = options.dlsiteParser ?? DLSITE_PARSER;
  const query = new WorkQueryRepository(db);
  const catalog = new CatalogWorkRepository(db);
  const user = new UserWorkStateRepository(db);
  const thumbnailCacheDir = options.thumbnailCacheDir ?? join(tmpdir(), "mimimilli-memory-cache");
  const thumbnailCache = new ThumbnailCache(options.thumbnailCache);
  const scanner = new Scanner(
    db,
    { query, catalog, user },
    { measureCover: measureCoverDimensions, dlsiteCache, resolveRoot: () => requireRoot() },
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
  initializeSmartFolders(user);

  const { requireRoot, ...settingsScanMethods } = createSettingsScanMethods({
    database: options.database,
    query,
    catalog,
    user,
    scanner,
    thumbnailCacheDir,
    dlsiteCache,
    parser,
    runFileScanInWorker: assembly.runFileScanInWorker ?? runFileScanInWorker,
  });
  const { abortDlsiteWork, ...dlsiteMethods } = createDlsiteMethods({
    db,
    query,
    catalog,
    scanner,
    dlsiteCache,
    dlsiteCacheOptions: options.dlsiteCache,
    parser,
    dlsiteRequestConfig,
    dlsiteScheduler,
    schedulerDependencies: options.dlsiteSchedulerDependencies,
    requireRoot,
  });
  const coverMediaMethods = createCoverMediaMethods({
    query,
    catalog,
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
    dlsiteCache,
    parser,
  });
  const tagPrefixMethods = createTagPrefixMethods({ query, user });
  const smartFolderMethods = createSmartFolderMethods({ user });

  return {
    ...settingsScanMethods,
    ...workMethods,
    ...tagPrefixMethods,
    ...smartFolderMethods,
    ...coverMediaMethods,
    ...dlsiteMethods,
    async close(): Promise<void> {
      await abortDlsiteWork();
      dlsiteCache.close();
      db.close();
    },
  };
}
