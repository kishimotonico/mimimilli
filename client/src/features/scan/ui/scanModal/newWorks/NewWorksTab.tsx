/* oxlint-disable jsx-a11y/prefer-tag-over-role -- 仮想リストは行を絶対配置するため table 要素にできず、ARIA table 構造を role で与える */
import type { WorkspacePath } from "@mimimilli/shared";
import { useRef } from "react";
import { SourceProjectionNotice } from "../../../../../entities/work/ui/SourceProjectionNotice";
import { cn } from "../../../../../shared/lib/cn";
import CollectionStatus from "../../../../../shared/ui/CollectionStatus";
import { useVirtualList } from "../../../../../shared/ui/useVirtualList";
import { LIST_HEADING_ROW_CLASS } from "../listHeading";
import ScanListState from "../ScanListState";
import { useDisplayedScanListStatus } from "../useDisplayedScanListStatus";
import { useScanRecordWorks } from "../useScanRecordWorks";
import { NEW_WORKS_GRID_CLASS, ROW_HEIGHT } from "./layout";
import NewWorkRow from "./NewWorkRow";
import { useInlineTitleEdit } from "./useInlineTitleEdit";

interface NewWorksTabProps {
  onOpenFiles: (path: WorkspacePath) => void;
  onOpenWorkDetail: (workId: string) => void;
}

export default function NewWorksTab({ onOpenFiles, onOpenWorkDetail }: NewWorksTabProps) {
  const {
    works,
    total,
    status: rawStatus,
    retry,
    nextPageError,
    retryNextPage,
    infiniteScroll,
  } = useScanRecordWorks("new");
  const status = useDisplayedScanListStatus(rawStatus);
  const edit = useInlineTitleEdit();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { virtualItems, wrapperStyle, getItemStyle } = useVirtualList({
    count: works.length,
    estimateSize: ROW_HEIGHT,
    scrollRef,
    infiniteScroll,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {status === "ready" && (
        <SourceProjectionNotice
          projection={edit.projection}
          path={edit.projectionPath}
          onProjected={edit.applyProjected}
        />
      )}
      <ScanListState
        status={status}
        emptyMessage="新規作品はありません"
        onRetry={retry}
        table={{ label: "新規作品", rowCount: total + 1 }}
        heading={
          <div role="rowgroup" className="shrink-0">
            <div role="row" className={cn(NEW_WORKS_GRID_CLASS, LIST_HEADING_ROW_CLASS)}>
              <span role="columnheader">カバー</span>
              <span role="columnheader">タイトル</span>
              <span role="columnheader">RJコード</span>
              <span role="columnheader">DLsite</span>
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
