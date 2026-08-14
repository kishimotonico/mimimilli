// データアダプタ境界（ADR-0002）。
// ルーター・ドメインロジックは1系統だけ持ち、データの出どころをこのインターフェースで差し替える:
//   - fixture アダプタ: インメモリ fixtures（開発・ビジュアルテスト用）
//   - real アダプタ:    SQLite + 実ファイルシステム（移行プラン ステップ3で実装）
export type { ScanOptions, SettingsAdapter } from "./settings.ts";
export type { WorkAdapter } from "./work.ts";
export type { ClassificationAdapter } from "./classification.ts";
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

import type { ClassificationAdapter } from "./classification.ts";
import type { DlsiteAdapter } from "./dlsite.ts";
import type { FsAdapter } from "./fs.ts";
import type { MediaAdapter } from "./media.ts";
import type { SettingsAdapter } from "./settings.ts";
import type { WorkAdapter } from "./work.ts";

export type DataAdapter = SettingsAdapter &
  WorkAdapter &
  ClassificationAdapter &
  FsAdapter &
  MediaAdapter &
  DlsiteAdapter & {
    close?: () => void | Promise<void>;
  };
