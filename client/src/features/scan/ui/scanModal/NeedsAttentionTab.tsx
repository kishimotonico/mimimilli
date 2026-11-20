import type { WorkspacePath } from "@mimimilli/shared";
import StatusLabel from "../../../../shared/ui/StatusLabel";
import { isFixable, type NeedsAttentionRow } from "../../model/needsAttention";
import { deriveScanListStatus } from "../../model/scanListStatus";
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
const CELL_CLASS = "px-2.5 py-2 align-top font-jp text-secondary text-ink-1";
const ID_CLASS = "mll-selectable break-all font-mono text-mono text-ink-1";

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
      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-paper-0 text-left">
              {HEADINGS.map((heading) => (
                <th
                  key={heading}
                  className="border-b border-line-soft px-2.5 py-1.5 font-sans text-label font-semibold text-ink-2"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-line-soft">
                <td className={CELL_CLASS}>
                  <StatusLabel tone={isFixable(row) ? "attention" : "none"}>
                    {KIND_LABEL[row.kind]}
                  </StatusLabel>
                </td>
                <td className={CELL_CLASS}>
                  <TargetCell
                    row={row}
                    onOpenFiles={onOpenFiles}
                    onOpenWorkDetail={onOpenWorkDetail}
                  />
                </td>
                <td className={CELL_CLASS}>{whatHappened(row)}</td>
                <td className={CELL_CLASS}>
                  <RecommendedAction row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <div className="flex flex-col gap-1">
          {row.registered && (
            <div className="flex flex-col gap-0.5">
              <SideLabel>登録済み</SideLabel>
              {row.registered.path !== null && (
                <PathLink path={row.registered.path} onOpen={onOpenFiles} />
              )}
              <div className="flex min-w-0 items-baseline gap-2">
                {row.registered.title !== null && (
                  <WorkTitleLink
                    workId={row.workId}
                    title={row.registered.title}
                    onOpen={onOpenWorkDetail}
                  />
                )}
                <span className={ID_CLASS}>作品ID {row.workId}</span>
              </div>
            </div>
          )}
          {row.unregisteredPaths.map((path) => (
            <div key={path} className="flex flex-col gap-0.5">
              <SideLabel>未登録</SideLabel>
              <div className="flex min-w-0 items-center gap-2">
                <PathLink path={path} onOpen={onOpenFiles} />
                <ReassignIdentityButton path={path} />
              </div>
            </div>
          ))}
        </div>
      );
    case "invalidMetaFile":
    case "unreadablePath":
      return <PathLink path={row.path} onOpen={onOpenFiles} />;
    case "dataIntegrity":
      return (
        <div className="flex flex-col gap-0.5">
          {row.title !== null && <span className="font-jp text-body text-ink-0">{row.title}</span>}
          <span className={ID_CLASS}>{row.workId}</span>
        </div>
      );
    case "missingWork":
      return (
        <div className="flex flex-col gap-0.5">
          <WorkTitleLink workId={row.workId} title={row.title} onOpen={onOpenWorkDetail} />
          {row.previousPath !== null && (
            <span className="mll-selectable break-all font-mono text-mono text-ink-3">
              {row.previousPath}
            </span>
          )}
        </div>
      );
  }
}

function whatHappened(row: NeedsAttentionRow): string {
  switch (row.kind) {
    case "identityConflict":
      return `同じ作品ID ${row.workId} の作品情報ファイルが複数ある`;
    case "invalidMetaFile":
      return row.message;
    case "unreadablePath":
      return "フォルダーを開く権限がない";
    case "dataIntegrity":
      return "保存データが壊れていて、一覧に出していない";
    case "missingWork":
      return "前回あったフォルダーが見つからない";
  }
}

function RecommendedAction({ row }: { row: NeedsAttentionRow }) {
  switch (row.kind) {
    case "identityConflict":
      return "どちらかを消すか、取り込む";
    case "invalidMetaFile":
      return "ファイルを直す";
    case "unreadablePath":
      return "アクセス権を確認";
    case "dataIntegrity":
      return <ReloadWorkButton workId={row.workId} label={row.title ?? row.workId} />;
    case "missingWork":
      return <UnregisterWorkButton workId={row.workId} title={row.title} />;
  }
}

function SideLabel({ children }: { children: string }) {
  return <span className="font-sans text-label font-semibold text-ink-3">{children}</span>;
}
