import type { MissingWork, ScanDiagnostics, WorkspacePath } from "@mimimilli/shared";

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
export function buildNeedsAttentionRows(
  diagnostics: ScanDiagnostics | undefined,
): NeedsAttentionRow[] {
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
    ...sortedBy(diagnostics?.unreadablePaths ?? [], (path) => path).map(
      (path): NeedsAttentionRow => ({ kind: "unreadablePath", key: `unreadable:${path}`, path }),
    ),
    ...sortedBy(diagnostics?.dataIntegrityWorkIds ?? [], (id) => id).map(
      (workId): NeedsAttentionRow => ({
        kind: "dataIntegrity",
        key: `integrity:${workId}`,
        workId,
      }),
    ),
    ...sortedBy(diagnostics?.missingWorks ?? [], (work) => work.title).map(
      (work): NeedsAttentionRow => ({
        ...work,
        kind: "missingWork",
        key: `missing:${work.workId}`,
      }),
    ),
  ];
}

/** 行方不明はファイルを直して消すものではないので、要対応の強調（attention）を付けない */
export function isFixable(row: NeedsAttentionRow): boolean {
  return row.kind !== "missingWork";
}
