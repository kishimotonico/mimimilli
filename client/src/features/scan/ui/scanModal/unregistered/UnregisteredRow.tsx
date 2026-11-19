/* oxlint-disable jsx-a11y/prefer-tag-over-role -- 仮想リストの行は絶対配置の div で組むため、tr/td ではなく role=row/cell で ARIA table 構造を与える */
import { memo } from "react";
import type { ScanCandidate } from "@mimimilli/shared";
import { getDlsiteCoverUrl } from "../../../../../entities/dlsite/dlsiteCoverUrl";
import Button from "../../../../../shared/ui/Button";
import { cn } from "../../../../../shared/lib/cn";
import type { CandidateDlsiteDisplay } from "../../../model/unregisteredDlsite";
import DlsiteStateCell from "./DlsiteStateCell";
import RjCodeCell, { type RjCodeCommitResult, type RjCodeFieldError } from "./RjCodeCell";
import { ROW_HEIGHT, UNREGISTERED_GRID_CLASS } from "./layout";

export interface UnregisteredRowHandlers {
  onToggle: (path: string) => void;
  onStartEdit: (path: string) => void;
  onCommitEdit: (path: string, value: string) => RjCodeCommitResult;
  onCancelEdit: (path: string) => void;
  onFetchSingle: (rjCode: string) => void;
}

interface UnregisteredRowProps {
  candidate: ScanCandidate;
  display: CandidateDlsiteDisplay;
  selected: boolean;
  editing: boolean;
  error: RjCodeFieldError | undefined;
  busy: boolean;
  handlers: UnregisteredRowHandlers;
}

function missingWorkNote(candidate: ScanCandidate): { text: string; full: string } | null {
  const titles = candidate.missingWorks.map((work) => work.title);
  const first = titles[0];
  if (first === undefined) return null;
  return {
    text:
      titles.length > 1 ? `行方不明: ${first} ほか${titles.length - 1}件` : `行方不明: ${first}`,
    full: titles.join("\n"),
  };
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
  selected,
  editing,
  error,
  busy,
  handlers,
}: UnregisteredRowProps) {
  const { path, rjCode } = candidate;
  const dlsiteTitle = display.state === "fetched" ? display.title : null;
  const note = missingWorkNote(candidate);
  const action = rowAction(candidate, display);

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
          title={error ? "値にエラーがあるため、直すまで追加の対象から外れます" : undefined}
          onChange={() => handlers.onToggle(path)}
        />
      </div>
      <div role="cell" className="flex items-center">
        <RowCover display={display} />
      </div>
      <div role="cell" className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="truncate font-jp text-body text-ink-0" title={dlsiteTitle ?? undefined}>
          {dlsiteTitle ?? candidate.inferredTitle}
        </span>
        <span className="flex min-w-0 items-center gap-2 font-jp text-caption text-ink-2">
          <span className="truncate">
            {dlsiteTitle ? candidate.inferredTitle : `音声 ${candidate.audioFileCount}件`}
          </span>
          {note && (
            <span
              title={note.full}
              className="shrink-0 truncate rounded-[3px] bg-paper-2 px-1.5 text-ink-1"
              style={{ maxWidth: 220 }}
            >
              {note.text}
            </span>
          )}
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
        <DlsiteStateCell display={display} />
      </div>
      <div role="cell" className="flex items-center">
        {action && (
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() =>
              action.kind === "fix"
                ? handlers.onStartEdit(path)
                : handlers.onFetchSingle(action.code)
            }
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

type RowAction = { kind: "fix"; label: string } | { kind: "fetch"; label: string; code: string };

function rowAction(candidate: ScanCandidate, display: CandidateDlsiteDisplay): RowAction | null {
  if (candidate.rjCode === null) return null;
  if (display.state === "not_found") return { kind: "fix", label: "修正" };
  if (display.state === "failed") return { kind: "fetch", label: "再試行", code: candidate.rjCode };
  if (display.state === "none" && candidate.rjCodeEdited) {
    return { kind: "fetch", label: "取得", code: candidate.rjCode };
  }
  return null;
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
    previous.selected === next.selected &&
    previous.editing === next.editing &&
    previous.error === next.error &&
    previous.busy === next.busy &&
    previous.handlers === next.handlers &&
    sameDisplay(previous.display, next.display),
);

export default UnregisteredRow;
