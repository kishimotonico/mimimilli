import type { MissingWork, ScanDiagnostics, ScanRecord, WorkspacePath } from "@mimimilli/shared";

export interface NeedsAttentionSource {
  diagnostics: ScanDiagnostics | undefined;
  record: ScanRecord | undefined;
}

export type NeedsAttentionRow =
  | { kind: "identityConflict"; key: string; workId: string; paths: WorkspacePath[] }
  | { kind: "invalidMetaFile"; key: string; path: WorkspacePath; message: string }
  | { kind: "unreadablePath"; key: string; path: WorkspacePath }
  | { kind: "dataIntegrity"; key: string; workId: string }
  | ({ kind: "missingWork"; key: string } & MissingWork);

const collator = new Intl.Collator("ja", { numeric: true });

function sortedBy<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  return [...items].sort((a, b) => collator.compare(keyOf(a), keyOf(b)));
}

/** 表示順は ID重複 → 読み取り失敗 → アクセス不可 → データ不整合 → 行方不明。種類の中は名前順 */
export function buildNeedsAttentionRows({
  diagnostics,
  record,
}: NeedsAttentionSource): NeedsAttentionRow[] {
  return [
    ...sortedBy(diagnostics?.identityConflicts ?? [], (c) => c.paths[0] ?? c.workId).map(
      (conflict): NeedsAttentionRow => ({
        kind: "identityConflict",
        key: `identity:${conflict.workId}`,
        workId: conflict.workId,
        paths: conflict.paths,
      }),
    ),
    ...sortedBy(diagnostics?.invalidMetaFiles ?? [], (f) => f.path).map(
      (file): NeedsAttentionRow => ({
        kind: "invalidMetaFile",
        key: `invalid:${file.path}`,
        path: file.path,
        message: file.message,
      }),
    ),
    ...sortedBy(record?.unreadablePaths ?? [], (path) => path).map(
      (path): NeedsAttentionRow => ({ kind: "unreadablePath", key: `unreadable:${path}`, path }),
    ),
    ...sortedBy(record?.dataIntegrityWarning?.skippedWorkIds ?? [], (id) => id).map(
      (workId): NeedsAttentionRow => ({
        kind: "dataIntegrity",
        key: `integrity:${workId}`,
        workId,
      }),
    ),
    ...sortedBy(record?.missingWorks ?? [], (work) => work.title).map(
      (work): NeedsAttentionRow => ({
        ...work,
        kind: "missingWork",
        key: `missing:${work.workId}`,
      }),
    ),
  ];
}

/** 行方不明は利用者が直すものではないので、サイドバーの件数には数えない */
export function isFixable(row: NeedsAttentionRow): boolean {
  return row.kind !== "missingWork";
}

export function countNeedsAttention(rows: readonly NeedsAttentionRow[]): number {
  return rows.filter(isFixable).length;
}
