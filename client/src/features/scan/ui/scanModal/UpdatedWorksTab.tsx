import type { WorkListItem } from "@mimimilli/shared";

export interface UpdatedWorksTabProps {
  updatedWorks: WorkListItem[];
  updatedWorksError: string | null;
  /** updatedWorkIds総数がupdatedWorksより多く、表示を先頭のみに絞っているときはその総数。絞っていなければnull */
  truncatedTotal: number | null;
}

export default function UpdatedWorksTab({
  updatedWorks,
  updatedWorksError,
  truncatedTotal,
}: UpdatedWorksTabProps) {
  if (updatedWorksError) {
    return (
      <p role="alert" className="font-jp text-[12px] text-[var(--r-coral)]">
        {updatedWorksError}
      </p>
    );
  }

  if (updatedWorks.length === 0) {
    return <p className="font-jp text-[12px] text-ink-3">今回更新された作品はありません。</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {truncatedTotal !== null && (
        <div className="flex justify-end">
          <span className="font-mono text-[10px] text-ink-4 tabular-nums">
            {updatedWorks.length} / {truncatedTotal} 件
          </span>
        </div>
      )}
      <ul className="flex list-none flex-col gap-1 p-0">
        {updatedWorks.map((work) => (
          <li
            key={work.id}
            className="flex items-center gap-2 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 py-1.5"
          >
            <span className="min-w-0 flex-1 truncate font-jp text-[12.5px] text-ink-0">
              {work.title}
            </span>
            <span className="shrink-0 font-mono text-[10.5px] text-ink-4">
              {work.trackCount} tracks
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
