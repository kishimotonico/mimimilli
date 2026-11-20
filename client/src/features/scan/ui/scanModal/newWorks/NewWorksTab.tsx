/* oxlint-disable jsx-a11y/prefer-tag-over-role -- 仮想リストは行を絶対配置するため table 要素にできず、ARIA table 構造を role で与える */
import type { WorkspacePath } from "@mimimilli/shared";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { scanRecordQueryOptions } from "../../../../../entities/scan/queryOptions";
import { SourceProjectionNotice } from "../../../../../entities/work/ui/SourceProjectionNotice";
import { cn } from "../../../../../shared/lib/cn";
import { useVirtualList } from "../../../../../shared/ui/useVirtualList";
import { deriveScanListStatus } from "../../../model/scanListStatus";
import ScanListState from "../ScanListState";
import { useScanRecordWorks } from "../useScanRecordWorks";
import { NEW_WORKS_GRID_CLASS, ROW_HEIGHT } from "./layout";
import NewWorkRow from "./NewWorkRow";
import { useInlineTitleEdit } from "./useInlineTitleEdit";

const HEADING_CLASS = "font-sans text-label font-semibold text-ink-2";

interface NewWorksTabProps {
  onOpenFiles: (path: WorkspacePath) => void;
  onOpenWorkDetail: (workId: string) => void;
}

export default function NewWorksTab({ onOpenFiles, onOpenWorkDetail }: NewWorksTabProps) {
  const recordQuery = useQuery(scanRecordQueryOptions);
  const { works, total, loading, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useScanRecordWorks("new");
  const edit = useInlineTitleEdit();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { virtualItems, wrapperStyle, getItemStyle } = useVirtualList({
    count: works.length,
    estimateSize: ROW_HEIGHT,
    scrollRef,
    infiniteScroll: { hasNextPage, isFetchingNextPage, onLoadMore: fetchNextPage },
  });

  const status = deriveScanListStatus({
    loading: loading || recordQuery.isPending,
    error: error || (recordQuery.isError && recordQuery.data === undefined),
    notScanned: recordQuery.data?.finishedAt === null,
    count: total,
  });
  const retry = () => {
    if (recordQuery.isError) void recordQuery.refetch();
    if (error) refetch();
  };

  return (
    <ScanListState status={status} emptyMessage="新規作品はありません" onRetry={retry}>
      <div className="flex min-h-0 flex-1 flex-col">
        <SourceProjectionNotice
          projection={edit.projection}
          path={edit.projectionPath}
          onProjected={edit.applyProjected}
        />
        <div
          role="table"
          aria-label="新規作品"
          aria-rowcount={total + 1}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div role="rowgroup" className="shrink-0">
            <div
              role="row"
              className={cn(NEW_WORKS_GRID_CLASS, "h-[30px] border-b border-line-soft bg-paper-0")}
            >
              <span role="columnheader" className={HEADING_CLASS}>
                カバー
              </span>
              <span role="columnheader" className={HEADING_CLASS}>
                タイトル
              </span>
              <span role="columnheader" className={HEADING_CLASS}>
                RJコード
              </span>
              <span role="columnheader" className={HEADING_CLASS}>
                DLsite
              </span>
            </div>
          </div>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div role="rowgroup" style={wrapperStyle}>
              {virtualItems.map((virtualRow) => {
                const work = works[virtualRow.index];
                if (!work) return null;
                return (
                  <div key={work.id} style={{ ...getItemStyle(virtualRow), height: ROW_HEIGHT }}>
                    <NewWorkRow
                      work={work}
                      edit={edit}
                      onOpenFiles={onOpenFiles}
                      onOpenWorkDetail={onOpenWorkDetail}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </ScanListState>
  );
}
