import type { ScanResult } from "@mimimilli/shared";
import type { ScanOptions } from "./settings.ts";

/** 永続化された再設定状態。キーがなければ通常運用（ADR-0029）。 */
export type RootReconfigurationRecord =
  | { phase: "running"; rootFolder: string }
  | { phase: "failed"; rootFolder: string; message: string };

/** root再設定のI/O。状態遷移とジョブの終了順序は RootReconfigurationWorkflow が持つ。 */
export interface RootReconfigurationAdapter {
  /** 検証して正規化したrootを返す。不正なら InvalidRootFolderError。 */
  resolveRootFolder(requested: string): Promise<string>;
  getRootReconfigurationRecord(): Promise<RootReconfigurationRecord | null>;
  /** root_folder の確定と running を同時に永続化する。rootが変わるなら候補除外と候補sessionを破棄する。 */
  beginRootReconfiguration(rootFolder: string): Promise<void>;
  /** rootの配下にない作品をcatalogから削除し、rootをフルスキャンする。 */
  rebuildCatalogForRoot(
    rootFolder: string,
    options: Omit<ScanOptions, "full">,
  ): Promise<ScanResult>;
  failRootReconfiguration(message: string): Promise<void>;
  completeRootReconfiguration(): Promise<void>;
}
