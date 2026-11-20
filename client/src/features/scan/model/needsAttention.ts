import type { MissingWork, ScanDiagnostics, WorkspacePath } from "@mimimilli/shared";

/** ID重複の登録済みの側。title は読めないとき null、path は診断のパスにないとき null */
export interface RegisteredSide {
  title: string | null;
  path: WorkspacePath | null;
}

export type NeedsAttentionRow =
  | {
      kind: "identityConflict";
      key: string;
      workId: string;
      registered: RegisteredSide | null;
      unregisteredPaths: WorkspacePath[];
    }
  | { kind: "invalidMetaFile"; key: string; path: WorkspacePath; message: string }
  | { kind: "unreadablePath"; key: string; path: WorkspacePath }
  | { kind: "dataIntegrity"; key: string; workId: string; title: string | null }
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
        registered:
          conflict.registeredTitle === null && conflict.registeredPath === null
            ? null
            : { title: conflict.registeredTitle, path: conflict.registeredPath },
        unregisteredPaths: conflict.paths.filter((path) => path !== conflict.registeredPath),
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
    ...sortedBy(diagnostics?.dataIntegrityWorks ?? [], (work) => work.title ?? work.workId).map(
      (work): NeedsAttentionRow => ({
        kind: "dataIntegrity",
        key: `integrity:${work.workId}`,
        workId: work.workId,
        title: work.title,
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
