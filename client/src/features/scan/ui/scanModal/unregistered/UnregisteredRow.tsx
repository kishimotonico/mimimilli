/* oxlint-disable jsx-a11y/prefer-tag-over-role -- 仮想リストの行は絶対配置の div で組むため、tr/td ではなく role=row/cell で ARIA table 構造を与える */
import { memo } from "react";
import type { ScanCandidate } from "@mimimilli/shared";
import { getDlsiteCoverUrl } from "../../../../../entities/dlsite/dlsiteCoverUrl";
import { I } from "../../../../../shared/ui/Icon";
import RowMenu from "./RowMenu";
import { cn } from "../../../../../shared/lib/cn";
import type { CandidateDlsiteDisplay } from "../../../model/unregisteredDlsite";
import { rowTitle } from "../../../model/unregisteredSelection";
import DlsiteStateCell from "./DlsiteStateCell";
import RjCodeCell, { type RjCodeCommitResult, type RjCodeFieldError } from "./RjCodeCell";
import { ROW_HEIGHT, UNREGISTERED_GRID_CLASS } from "./layout";

export interface UnregisteredRowHandlers {
  onToggle: (path: string) => void;
  onStartEdit: (path: string) => void;
  onCommitEdit: (path: string, value: string) => RjCodeCommitResult;
  onCancelEdit: (path: string) => void;
  onExclude: (path: string) => void;
  onOpenFolder: (path: ScanCandidate["path"]) => void;
}

interface UnregisteredRowProps {
  candidate: ScanCandidate;
  display: CandidateDlsiteDisplay;
  /** 判断が要る行 */
  flagged: boolean;
  selected: boolean;
  editing: boolean;
  error: RjCodeFieldError | undefined;
  busy: boolean;
  handlers: UnregisteredRowHandlers;
}

function missingWorkChip(
  candidate: ScanCandidate,
  shownTitle: string,
): { label: string; hover: string } | null {
  const [first, ...rest] = candidate.missingWorks;
  if (first === undefined) return null;
  const label =
    rest.length > 0
      ? `行方不明 ${candidate.missingWorks.length}件`
      : first.title === shownTitle
        ? "行方不明"
        : `行方不明: ${first.title}`;
  const hover = candidate.missingWorks
    .map(
      (work) =>
        `行方不明の作品: ${work.title}${work.previousPath ? `\n最後のパス: ${work.previousPath}` : ""}`,
    )
    .join("\n\n");
  return { label, hover };
}

function RowCover({ display }: { display: CandidateDlsiteDisplay }) {
  const cover = display.state === "fetched" ? display.cover : null;
  return (
    <span
      aria-hidden="true"
      className="block size-9 shrink-0 overflow-hidden rounded-[4px] border border-line-soft bg-paper-2"
    >
      {cover && (
        <img
          src={getDlsiteCoverUrl(cover)}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      )}
    </span>
  );
}

function UnregisteredRowView({
  candidate,
  display,
  flagged,
  selected,
  editing,
  error,
  busy,
  handlers,
}: UnregisteredRowProps) {
  const { path, rjCode } = candidate;
  const dlsiteTitle = display.state === "fetched" ? display.title : null;
  const title = rowTitle({ candidate, display });
  const chip = missingWorkChip(candidate, title);

  return (
    <div
      role="row"
      style={{ height: ROW_HEIGHT }}
      className={cn(UNREGISTERED_GRID_CLASS, "border-b border-line-soft")}
    >
      <div role="cell" className="flex items-center">
        <input
          type="checkbox"
          aria-label={`「${candidate.inferredTitle}」を選択`}
          checked={selected}
          disabled={busy || Boolean(error)}
          onChange={() => handlers.onToggle(path)}
        />
      </div>
      <div role="cell" className="flex items-center">
        <RowCover display={display} />
      </div>
      <div role="cell" className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          {flagged && (
            <I.err size={13} aria-hidden="true" className="shrink-0 text-[var(--state-danger)]" />
          )}
          <span
            className={cn("truncate font-jp text-body text-ink-0", dlsiteTitle && "font-medium")}
            title={title}
          >
            {title}
          </span>
          {chip && (
            <span
              title={chip.hover}
              className="inline-flex h-[17px] max-w-[220px] shrink-0 items-center truncate rounded-[4px] bg-[color-mix(in_oklch,var(--state-danger)_11%,transparent)] px-1.5 font-jp text-caption font-medium text-[color-mix(in_oklch,var(--state-danger)_85%,var(--ink-0))]"
            >
              {chip.label}
            </span>
          )}
        </span>
        <span className="truncate font-mono text-secondary text-ink-2" title={path}>
          {path}
        </span>
      </div>
      <div role="cell" className="flex min-w-0 flex-col justify-center">
        <RjCodeCell
          rjCode={rjCode}
          editing={editing}
          error={error}
          disabled={busy}
          onStartEdit={() => handlers.onStartEdit(path)}
          onCommit={(value) => handlers.onCommitEdit(path, value)}
          onCancel={() => handlers.onCancelEdit(path)}
        />
      </div>
      <div role="cell" className="flex items-center">
        <DlsiteStateCell display={display} hasCode={rjCode !== null} />
      </div>
      <div role="cell" className="flex items-center justify-end">
        <RowMenu
          label={`「${title}」の操作`}
          disabled={busy}
          onOpenFolder={() => handlers.onOpenFolder(path)}
          onExclude={() => handlers.onExclude(path)}
        />
      </div>
    </div>
  );
}

function sameDisplay(a: CandidateDlsiteDisplay, b: CandidateDlsiteDisplay): boolean {
  if (a.state !== b.state) return false;
  if (a.state !== "fetched" || b.state !== "fetched") return true;
  return (
    a.title === b.title && a.cover?.key === b.cover?.key && a.cover?.version === b.cover?.version
  );
}

const UnregisteredRow = memo(
  UnregisteredRowView,
  (previous, next) =>
    previous.candidate === next.candidate &&
    previous.flagged === next.flagged &&
    previous.selected === next.selected &&
    previous.editing === next.editing &&
    previous.error === next.error &&
    previous.busy === next.busy &&
    previous.handlers === next.handlers &&
    sameDisplay(previous.display, next.display),
);

export default UnregisteredRow;
