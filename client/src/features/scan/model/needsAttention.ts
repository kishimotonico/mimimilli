// 「要対応」の一元定義（TASK-428.4）。通知ベルのバッジと要対応タブのバッジが
// 同じ問題一覧・同じ件数を出すよう、両方がこのビルダーの結果だけを見る。
// 件数は「問題の件数（行数）」で数える。ID重複は競合（workId）単位で1件。
import type { DataIntegrityWarning, InvalidMetaFile, ScanDiagnostic } from "@mimimilli/shared";

export interface NeedsAttentionSource {
  identityConflicts: ScanDiagnostic[];
  invalidMetaFiles: InvalidMetaFile[];
  rjCodeMissingCount: number;
  dlsiteFetchFailedCount: number;
  dlsiteParseErrorCount: number;
  dlsiteParseErrorAlert: boolean;
  dataIntegrityWarning: DataIntegrityWarning | undefined;
}

export type NeedsAttentionRow =
  | { kind: "identityConflict"; key: string; workId: string; paths: string[] }
  | { kind: "invalidMetaFile"; key: string; path: string; message: string }
  | { kind: "rjCodeMissing"; key: string; count: number }
  | { kind: "dlsiteFetchFailed"; key: string; count: number }
  | { kind: "dlsiteParseFailed"; key: string; count: number }
  | { kind: "dataIntegrity"; key: string; count: number };

export function buildNeedsAttentionRows(source: NeedsAttentionSource): NeedsAttentionRow[] {
  const rows: NeedsAttentionRow[] = [];

  for (const conflict of source.identityConflicts) {
    rows.push({
      kind: "identityConflict",
      key: `identity-${conflict.workId}`,
      workId: conflict.workId,
      paths: conflict.paths,
    });
  }

  for (const metaFile of source.invalidMetaFiles) {
    rows.push({
      kind: "invalidMetaFile",
      key: `meta-${metaFile.path}`,
      path: metaFile.path,
      message: metaFile.message,
    });
  }

  if (source.rjCodeMissingCount > 0) {
    rows.push({ kind: "rjCodeMissing", key: "rj-missing", count: source.rjCodeMissingCount });
  }

  if (source.dlsiteFetchFailedCount > 0) {
    rows.push({
      kind: "dlsiteFetchFailed",
      key: "dlsite-fetch-failed",
      count: source.dlsiteFetchFailedCount,
    });
  }

  if (source.dlsiteParseErrorAlert) {
    rows.push({
      kind: "dlsiteParseFailed",
      key: "dlsite-parse-failed",
      count: source.dlsiteParseErrorCount,
    });
  }

  if (source.dataIntegrityWarning) {
    rows.push({
      kind: "dataIntegrity",
      key: "data-integrity",
      count: source.dataIntegrityWarning.skippedCount,
    });
  }

  return rows;
}

/** バッジ・タブ件数に足す重み。ID重複・読み取り失敗・データ不整合は
 *  「見つかった問題」単位で1件、それ以外は影響件数をそのまま使う。 */
export function needsAttentionRowWeight(row: NeedsAttentionRow): number {
  switch (row.kind) {
    case "identityConflict":
    case "invalidMetaFile":
    case "dataIntegrity":
      return 1;
    case "rjCodeMissing":
    case "dlsiteFetchFailed":
    case "dlsiteParseFailed":
      return row.count;
  }
}

/** 通知ベルのバッジと要対応タブが同じ件数を出すための唯一の集計関数（TASK-428.4）。 */
export function countNeedsAttention(rows: NeedsAttentionRow[]): number {
  return rows.reduce((total, row) => total + needsAttentionRowWeight(row), 0);
}
