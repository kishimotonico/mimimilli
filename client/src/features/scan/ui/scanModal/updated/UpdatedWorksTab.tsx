/* oxlint-disable jsx-a11y/prefer-tag-over-role -- 仮想リストは行を絶対配置するため table 要素にできず、ARIA table 構造を role で与える */
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WorkChange, WorkChangeKind, WorkspacePath } from "@mimimilli/shared";
import { scanRecordQueryOptions } from "../../../../../entities/scan/queryOptions";
import { cn } from "../../../../../shared/lib/cn";
import CollectionStatus from "../../../../../shared/ui/CollectionStatus";
import { useVirtualList } from "../../../../../shared/ui/useVirtualList";
import { LIST_HEADING_ROW_CLASS } from "../listHeading";
import ScanListState from "../ScanListState";
import { useDisplayedScanListStatus } from "../useDisplayedScanListStatus";
import { useScanRecordWorks } from "../useScanRecordWorks";
import ChangeKindFilter from "./ChangeKindFilter";
import { UPDATED_GRID_CLASS, UPDATED_ROW_ESTIMATE } from "./layout";
import UpdatedWorkRow from "./UpdatedWorkRow";

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

  // 件数が0になった種類の絞り込みは、件数が戻っても復活しないよう state ごと解除する
  const kindGone = kind !== null && updatedWorks !== undefined && counts[kind] === 0;
  if (kindGone) setKind(null);
  const activeKind = kindGone ? null : kind;

  const {
    works,
    total,
    status: rawStatus,
    retry,
    nextPageError,
    retryNextPage,
    infiniteScroll,
  } = useScanRecordWorks("updated", activeKind ?? undefined);
  const status = useDisplayedScanListStatus(rawStatus);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { virtualizer, virtualItems, wrapperStyle, getItemStyle } = useVirtualList({
    count: works.length,
    estimateSize: UPDATED_ROW_ESTIMATE,
    scrollRef,
    resetKey: activeKind ?? "all",
    resetScrollTop: true,
    infiniteScroll,
  });

  const totalUpdated = updatedWorks?.length ?? 0;
  const chips = (
    <ChangeKindFilter value={activeKind} total={totalUpdated} counts={counts} onChange={setKind} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {totalUpdated > 0 && chips}
      <ScanListState
        status={status}
        emptyMessage="更新済みの作品はありません"
        onRetry={retry}
        table={{ label: "更新済みの作品", rowCount: total + 1 }}
        heading={
          <div role="rowgroup" className="shrink-0">
            <div role="row" className={cn(UPDATED_GRID_CLASS, LIST_HEADING_ROW_CLASS)}>
              <span role="columnheader">作品</span>
              <span role="columnheader">変更内容</span>
            </div>
          </div>
        }
      >
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
          {nextPageError && (
            <div role="row">
              <div role="cell">
                <CollectionStatus variant="list" kind="error" onRetry={retryNextPage} />
              </div>
            </div>
          )}
        </div>
      </ScanListState>
    </div>
  );
}
