/* oxlint-disable jsx-a11y/prefer-tag-over-role -- 仮想リストは行を絶対配置するため table 要素にできず、ARIA table 構造を role で与える */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WorkChange, WorkChangeKind, WorkspacePath } from "@mimimilli/shared";
import { scanRecordQueryOptions } from "../../../../../entities/scan/queryOptions";
import { cn } from "../../../../../shared/lib/cn";
import { useVirtualList } from "../../../../../shared/ui/useVirtualList";
import { deriveScanListStatus } from "../../../model/scanListStatus";
import ScanListState from "../ScanListState";
import { useScanRecordWorks } from "../useScanRecordWorks";
import ChangeKindFilter from "./ChangeKindFilter";
import { UPDATED_GRID_CLASS, UPDATED_ROW_ESTIMATE } from "./layout";
import UpdatedWorkRow from "./UpdatedWorkRow";

const HEADING_CLASS = "font-sans text-label font-semibold text-ink-2";
const NO_CHANGES: readonly WorkChange[] = [];

interface UpdatedWorksTabProps {
  onOpenFiles: (path: WorkspacePath) => void;
  onOpenWorkDetail: (workId: string) => void;
}

export default function UpdatedWorksTab({ onOpenFiles, onOpenWorkDetail }: UpdatedWorksTabProps) {
  const [kind, setKind] = useState<WorkChangeKind | null>(null);
  const recordQuery = useQuery(scanRecordQueryOptions);
  const updatedWorks = recordQuery.data?.updatedWorks;

  const { changesByWork, counts } = useMemo(() => {
    const byWork = new Map<string, readonly WorkChange[]>();
    const kindCounts: Record<WorkChangeKind, number> = { moved: 0, meta: 0, files: 0 };
    for (const entry of updatedWorks ?? []) {
      byWork.set(entry.workId, entry.changes);
      for (const changeKind of new Set(entry.changes.map((change) => change.kind))) {
        kindCounts[changeKind] += 1;
      }
    }
    return { changesByWork: byWork, counts: kindCounts };
  }, [updatedWorks]);

  useEffect(() => {
    if (kind !== null && updatedWorks && counts[kind] === 0) setKind(null);
  }, [kind, counts, updatedWorks]);

  const { works, total, loading, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useScanRecordWorks("updated", kind ?? undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { virtualizer, virtualItems, wrapperStyle, getItemStyle } = useVirtualList({
    count: works.length,
    estimateSize: UPDATED_ROW_ESTIMATE,
    scrollRef,
    resetKey: kind ?? "all",
    resetScrollTop: true,
    infiniteScroll: { hasNextPage, isFetchingNextPage, onLoadMore: fetchNextPage },
  });

  const totalUpdated = updatedWorks?.length ?? 0;
  const status = deriveScanListStatus({
    loading: loading || recordQuery.isPending,
    error: error || (recordQuery.isError && recordQuery.data === undefined),
    notScanned: recordQuery.data?.finishedAt === null,
    count: totalUpdated,
  });
  const retry = () => {
    if (recordQuery.isError) void recordQuery.refetch();
    if (error) refetch();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {totalUpdated > 0 && (
        <ChangeKindFilter value={kind} total={totalUpdated} counts={counts} onChange={setKind} />
      )}
      <ScanListState status={status} emptyMessage="更新済みの作品はありません" onRetry={retry}>
        <div
          role="table"
          aria-label="更新済みの作品"
          aria-rowcount={total + 1}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div role="rowgroup" className="shrink-0">
            <div
              role="row"
              className={cn(
                UPDATED_GRID_CLASS,
                "h-[30px] items-center border-b border-line-soft bg-paper-0",
              )}
            >
              <span role="columnheader" className={HEADING_CLASS}>
                作品
              </span>
              <span role="columnheader" className={HEADING_CLASS}>
                変更内容
              </span>
            </div>
          </div>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div role="rowgroup" style={wrapperStyle}>
              {virtualItems.map((virtualRow) => {
                const work = works[virtualRow.index];
                if (!work) return null;
                return (
                  <div
                    key={work.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={getItemStyle(virtualRow)}
                  >
                    <UpdatedWorkRow
                      work={work}
                      changes={changesByWork.get(work.id) ?? NO_CHANGES}
                      onOpenFiles={onOpenFiles}
                      onOpenWorkDetail={onOpenWorkDetail}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScanListState>
    </div>
  );
}
