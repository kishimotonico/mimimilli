import { pathBaseName, type WorkspacePath } from "@mimimilli/shared";
import type { ReactNode } from "react";
import { cn } from "../../../../shared/lib/cn";
import { isFixable, type NeedsAttentionRow } from "../../model/needsAttention";
import { deriveScanListStatus } from "../../model/scanListStatus";
import { LIST_HEADING_ROW_CLASS } from "./listHeading";
import ScanListState from "./ScanListState";
import {
  ReassignIdentityButton,
  ReloadWorkButton,
  UnregisterWorkButton,
} from "./NeedsAttentionActions";
import { PathLink, WorkTitleLink } from "./ScanLinks";

export interface NeedsAttentionTabProps {
  rows: NeedsAttentionRow[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenFiles: (path: WorkspacePath) => void;
  onOpenWorkDetail: (workId: string) => void;
}

const KIND_LABEL: Record<NeedsAttentionRow["kind"], string> = {
  identityConflict: "ID重複",
  invalidMetaFile: "読み取り失敗",
  unreadablePath: "アクセス不可",
  dataIntegrity: "データ不整合",
  missingWork: "行方不明",
};

const HEADINGS = ["種類", "対象", "起きていること", "推奨アクション"];
const GRID_CLASS =
  "grid gap-x-3.5 px-[18px] [grid-template-columns:84px_minmax(0,1fr)_minmax(0,0.7fr)_148px]";
const LINE_CLASS = "flex h-[26px] min-w-0 items-center gap-2";
const LINES_CLASS = "flex min-w-0 flex-col gap-[3px]";
const ID_CLASS = "mll-selectable truncate font-mono text-secondary text-ink-2";

export default function NeedsAttentionTab({
  rows,
  loading,
  error,
  onRetry,
  onOpenFiles,
  onOpenWorkDetail,
}: NeedsAttentionTabProps) {
  const status = deriveScanListStatus({ loading, error, count: rows.length });

  return (
    <ScanListState status={status} emptyMessage="要対応の項目はありません" onRetry={onRetry}>
      <div
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 行ごとに列の高さをそろえるため grid の div で組み、role で ARIA table 構造を与える
        role="table"
        aria-label="要対応"
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* oxlint-disable jsx-a11y/prefer-tag-over-role -- 同上 */}
        <div role="rowgroup" className="shrink-0">
          <div role="row" className={cn(GRID_CLASS, LIST_HEADING_ROW_CLASS)}>
            {HEADINGS.map((heading) => (
              <span key={heading} role="columnheader">
                {heading}
              </span>
            ))}
          </div>
        </div>
        <div role="rowgroup" className="min-h-0 flex-1 overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.key}
              role="row"
              className={cn(
                GRID_CLASS,
                "min-h-[54px] items-start border-b border-line-soft py-2.5 font-jp text-body",
              )}
            >
              <span
                role="cell"
                className={cn(
                  "whitespace-nowrap font-medium leading-[26px]",
                  isFixable(row) ? "text-[var(--state-danger)]" : "text-ink-1",
                )}
              >
                {KIND_LABEL[row.kind]}
              </span>
              <div role="cell" className="min-w-0">
                <TargetCell
                  row={row}
                  onOpenFiles={onOpenFiles}
                  onOpenWorkDetail={onOpenWorkDetail}
                />
              </div>
              <span role="cell" className="min-w-0 break-words pt-1 leading-normal text-ink-0">
                {whatHappened(row)}
              </span>
              <div role="cell" className="min-w-0 text-secondary text-ink-1">
                <RecommendedAction row={row} />
              </div>
            </div>
          ))}
        </div>
        {/* oxlint-enable jsx-a11y/prefer-tag-over-role */}
      </div>
    </ScanListState>
  );
}

function TargetCell({
  row,
  onOpenFiles,
  onOpenWorkDetail,
}: {
  row: NeedsAttentionRow;
  onOpenFiles: (path: WorkspacePath) => void;
  onOpenWorkDetail: (workId: string) => void;
}) {
  switch (row.kind) {
    case "identityConflict":
      return (
        <div className={LINES_CLASS}>
          {row.registered && (
            <div className={LINE_CLASS}>
              <SideLabel registered>登録済み</SideLabel>
              {row.registered.path !== null ? (
                <PathLink path={row.registered.path} onOpen={onOpenFiles} />
              ) : (
                row.registered.title !== null && (
                  <WorkTitleLink
                    workId={row.workId}
                    title={row.registered.title}
                    onOpen={onOpenWorkDetail}
                  />
                )
              )}
            </div>
          )}
          {row.unregisteredPaths.map((path) => (
            <div key={path} className={LINE_CLASS}>
              <SideLabel>未登録</SideLabel>
              <PathLink path={path} onOpen={onOpenFiles} />
            </div>
          ))}
        </div>
      );
    case "invalidMetaFile":
    case "unreadablePath":
      return (
        <div className={LINE_CLASS}>
          <PathLink path={row.path} onOpen={onOpenFiles} />
        </div>
      );
    case "dataIntegrity":
      return (
        <div className={LINES_CLASS}>
          {row.title !== null && (
            <div className={LINE_CLASS}>
              <span className="truncate text-ink-0">{row.title}</span>
            </div>
          )}
          <div className={LINE_CLASS}>
            <span className={ID_CLASS}>{row.workId}</span>
          </div>
        </div>
      );
    case "missingWork":
      return (
        <div className={LINES_CLASS}>
          <div className={LINE_CLASS}>
            <WorkTitleLink workId={row.workId} title={row.title} onOpen={onOpenWorkDetail} />
          </div>
          {row.previousPath !== null && (
            <div className={LINE_CLASS}>
              <span
                title={row.previousPath}
                className="mll-selectable truncate font-mono text-secondary text-ink-3 line-through"
              >
                {row.previousPath}
              </span>
            </div>
          )}
        </div>
      );
  }
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-secondary">{children}</span>;
}

function whatHappened(row: NeedsAttentionRow): ReactNode {
  switch (row.kind) {
    case "identityConflict":
      return (
        <>
          同じ作品ID <Mono>{row.workId}</Mono> の作品情報ファイルが複数ある
        </>
      );
    case "invalidMetaFile": {
      const fileName = pathBaseName(row.path);
      return row.message.startsWith(fileName) ? (
        <>
          <Mono>{fileName}</Mono>
          {row.message.slice(fileName.length)}
        </>
      ) : (
        row.message
      );
    }
    case "unreadablePath":
      return "フォルダーを開く権限がない";
    case "dataIntegrity":
      return "保存データが壊れていて、一覧に出していない";
    case "missingWork":
      return "前回あったフォルダーが見つからない";
  }
}

/** 操作の要る種類はボタンだけを、ない種類は短い文を置く。ID重複は対象の未登録の行と同じ高さにボタンを並べる */
function RecommendedAction({ row }: { row: NeedsAttentionRow }) {
  switch (row.kind) {
    case "identityConflict":
      return (
        <div className={LINES_CLASS}>
          {row.registered && <div className="h-[26px]" />}
          {row.unregisteredPaths.map((path) => (
            <div key={path} className="flex h-[26px] items-center">
              <ReassignIdentityButton path={path} />
            </div>
          ))}
        </div>
      );
    case "invalidMetaFile":
      return <ActionLine>ファイルを直す</ActionLine>;
    case "unreadablePath":
      return <ActionLine>アクセス権を確認</ActionLine>;
    case "dataIntegrity":
      return (
        <ActionLine>
          <ReloadWorkButton workId={row.workId} label={row.title ?? row.workId} />
        </ActionLine>
      );
    case "missingWork":
      return (
        <ActionLine>
          <UnregisterWorkButton workId={row.workId} title={row.title} />
        </ActionLine>
      );
  }
}

function ActionLine({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[26px] items-center">{children}</div>;
}

function SideLabel({ registered = false, children }: { registered?: boolean; children: string }) {
  return (
    <span
      className={cn(
        "w-11 shrink-0 font-jp text-caption",
        registered ? "font-medium text-[var(--state-success)]" : "text-ink-2",
      )}
    >
      {children}
    </span>
  );
}
