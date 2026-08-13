// 新規登録済み・更新された作品タブ共通のテーブル本体。
import type { WorkListItem } from "@mimimilli/shared";
import { dlsiteLinkDisplayStatus, hasRjCode } from "@mimimilli/shared";
import { cn } from "../../../../shared/lib/cn";
import { DLSITE_LINK_STATUS_LABEL, DLSITE_LINK_STATUS_TONE } from "./dlsiteLinkStatus";
import { parentDirOf } from "./scanResultWorkIds";
import type { InlineTitleEdit } from "./useInlineTitleEdit";

export interface ScanResultWorksTableProps {
  works: WorkListItem[];
  caption: string;
  emptyMessage: string;
  errorMessage: string | null;
  truncatedTotal: number | null;
  totalIds: number;
  edit: InlineTitleEdit;
}

export default function ScanResultWorksTable({
  works,
  caption,
  emptyMessage,
  errorMessage,
  truncatedTotal,
  totalIds,
  edit,
}: ScanResultWorksTableProps) {
  if (errorMessage) {
    return (
      <p role="alert" className="font-jp text-[12px] text-[var(--r-coral)]">
        {errorMessage}
      </p>
    );
  }

  if (totalIds === 0) {
    return <p className="font-jp text-[12px] text-ink-3">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-sans text-[10.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
          {caption}
        </p>
        <span className="font-mono text-[10px] text-ink-4 tabular-nums">
          {truncatedTotal !== null ? `${totalIds}件中${works.length}件を表示` : `${totalIds}件`}
        </span>
      </div>
      <table className="w-full table-fixed border-collapse text-[11px]">
        <colgroup>
          <col className="w-[38%]" />
          <col className="w-[26%]" />
          <col className="w-[24%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line-soft text-left font-sans text-[10px] font-semibold tracking-[0.04em] whitespace-nowrap text-ink-3 uppercase">
            <th className="px-2 py-1.5 font-semibold">タイトル</th>
            <th className="px-2 py-1.5 font-semibold">フォルダー</th>
            <th className="px-2 py-1.5 font-semibold">外部連携</th>
            <th className="px-2 py-1.5 text-right font-semibold">トラック</th>
          </tr>
        </thead>
        <tbody>
          {works.map((work) => (
            <WorkRow key={work.id} work={work} edit={edit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkRow({ work, edit }: { work: WorkListItem; edit: InlineTitleEdit }) {
  const editing = edit.editingId === work.id;
  const editError = edit.editErrorFor(work.id);
  const linkStatus = dlsiteLinkDisplayStatus(work.dlsite);
  const folderDisplay = parentDirOf(work.relativePath) || "（ルート直下）";

  return (
    <tr className="border-b border-line-soft last:border-b-0">
      <td className="min-w-0 px-2 py-1.5">
        {editing ? (
          <input
            ref={edit.titleInputRef}
            value={edit.editTitle}
            disabled={edit.editSaving}
            onChange={(e) => edit.changeTitle(e.target.value)}
            onBlur={() => edit.saveTitle(work.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") edit.saveTitle(work.id);
              if (e.key === "Escape") {
                // 入力欄側で編集を取り消し、モーダルのEscapeクローズ（<dialog>のcancel既定動作）
                // まで伝播させない。親は編集中かどうかを知らなくてよい。
                e.preventDefault();
                e.stopPropagation();
                edit.cancelEdit();
              }
            }}
            className={cn(
              "min-w-0 w-full rounded-[4px] border bg-paper-2 px-2 py-0.5 font-jp text-[12px] text-ink-0 outline-none disabled:opacity-60",
              editError ? "border-[var(--r-coral)]" : "border-acc",
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => edit.startEdit(work)}
            title="クリックしてタイトルを編集"
            className="min-w-0 max-w-full truncate text-left font-jp text-[12px] text-ink-0"
          >
            {work.title}
          </button>
        )}
        {editError && (
          <span
            role="alert"
            className="mll-selectable block font-jp text-[10.5px] text-[var(--r-coral)]"
          >
            {editError}
          </span>
        )}
      </td>
      <td className="min-w-0 px-2 py-1.5 font-mono text-[10.5px] text-ink-3">
        {/* 先頭側を省略し末尾（作品に近い部分）を残す。dir="rtl" + text-left の組み合わせで実現する */}
        <span dir="rtl" title={folderDisplay} className="block truncate text-left">
          {folderDisplay}
        </span>
      </td>
      <td className="min-w-0 px-2 py-1.5">
        <span
          className={cn(
            "block truncate font-mono text-[10.5px]",
            DLSITE_LINK_STATUS_TONE[linkStatus],
          )}
        >
          {hasRjCode(work.dlsite) ? work.dlsite.rjCode : "—"}
        </span>
        {hasRjCode(work.dlsite) && (
          <span className={cn("block font-jp text-[10.5px]", DLSITE_LINK_STATUS_TONE[linkStatus])}>
            {DLSITE_LINK_STATUS_LABEL[linkStatus]}
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-[10.5px] text-ink-4">
        {work.trackCount}
      </td>
    </tr>
  );
}
