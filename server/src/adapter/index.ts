// データアダプタ境界（ADR-0002）。
// ルーター・ドメインロジックは1系統だけ持ち、データの出どころをこのインターフェースで差し替える:
//   - fixture アダプタ: インメモリ fixtures（開発・ビジュアルテスト用）
//   - real アダプタ:    SQLite + 実ファイルシステム
export type {
  CandidateAvailability,
  CandidateDescriber,
  ScanExecution,
  ScanExecutionResult,
  ScanOptions,
  SettingsAdapter,
  StoredSettings,
} from "./settings.ts";
export type {
  RootReconfigurationAdapter,
  RootReconfigurationRecord,
} from "./rootReconfiguration.ts";
export type { WorkAdapter } from "./work.ts";
export type { TagPrefixAdapter } from "./tagPrefix.ts";
export type { SmartFolderAdapter } from "./smartFolder.ts";
export type { FsAdapter } from "./fs.ts";
export {
  createCoverValidators,
  type CoverDescriptor,
  type MediaAdapter,
  type CatalogMediaKind,
  type MediaLocation,
  type WorkspaceMedia,
} from "./media.ts";
export type { DlsiteAdapter } from "./dlsite.ts";

import type { DlsiteAdapter } from "./dlsite.ts";
import type { FsAdapter } from "./fs.ts";
import type { MediaAdapter } from "./media.ts";
import type { RootReconfigurationAdapter } from "./rootReconfiguration.ts";
import type { SettingsAdapter } from "./settings.ts";
import type { SmartFolderAdapter } from "./smartFolder.ts";
import type { TagPrefixAdapter } from "./tagPrefix.ts";
import type { WorkAdapter } from "./work.ts";

export type DataAdapter = SettingsAdapter &
  RootReconfigurationAdapter &
  WorkAdapter &
  TagPrefixAdapter &
  SmartFolderAdapter &
  FsAdapter &
  MediaAdapter &
  DlsiteAdapter & {
    close?: () => void | Promise<void>;
    /** fixture アダプタのみ実装。可変状態を初期シナリオへ戻す（smokeのテスト間分離用）。 */
    resetFixtureState?: () => void;
  };
