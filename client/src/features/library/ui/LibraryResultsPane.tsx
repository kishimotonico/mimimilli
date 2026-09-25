import type { ComponentProps } from "react";
import { AnimatePresence } from "motion/react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { NormalizedTag, SmartFolder, TagPrefix, Work, WorkListItem } from "@mimimilli/shared";
import type { LibraryViewActions, LibraryViewState } from "../model/useLibraryNavigation";
import type { useLibraryPreviewActions } from "../model/useLibraryPreviewActions";
import WorkGrid from "./WorkGrid";
import WorkListPane from "./WorkListPane";
import PreviewPaneSlide from "./PreviewPaneSlide";
import type { WorkResultsProps } from "./workResultsProps";
import { SmartFolderView } from "./preview/SmartFolderView";
import { DataIntegrityWarningBanner } from "./DataIntegrityWarningBanner";
import { ErrorViewBulkUnregisterBanner } from "./ErrorViewBulkUnregisterBanner";
import type LibraryWorksBoundary from "./LibraryWorksBoundary";

type WorksResult = Parameters<ComponentProps<typeof LibraryWorksBoundary>["children"]>[0];

interface LibraryResultsPaneProps {
  nav: LibraryViewState & LibraryViewActions;
  result: WorksResult;
  worksQueryKey: string;
  isPending: boolean;
  showGrid: boolean;
  dockedBarActive: boolean;
  activeSmartFolder: SmartFolder | null;
  isErrorView: boolean;
  missingWorksCount: number | undefined;
  tagPrefixes: TagPrefix[];
  tagSuggestions: string[];
  searchQuery: string;
  onClearSearch: () => void;
  onEditSmartFolderRules: () => void;
  selectedWork: Work | null;
  workDetailQuery: Pick<UseQueryResult<Work>, "isPending" | "isError" | "refetch">;
  previewActions: ReturnType<typeof useLibraryPreviewActions>;
  onTogglePlay: () => void;
  onWorkPlay: (work: WorkListItem) => void;
  onTagClick: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
}

/** LibraryWorksBoundary配下の結果面（バナー・作品一覧・選択中作品プレビュー）をまとめる。 */
export default function LibraryResultsPane({
  nav,
  result,
  worksQueryKey,
  isPending,
  showGrid,
  dockedBarActive,
  activeSmartFolder,
  isErrorView,
  missingWorksCount,
  tagPrefixes,
  tagSuggestions,
  searchQuery,
  onClearSearch,
  onEditSmartFolderRules,
  selectedWork,
  workDetailQuery,
  previewActions,
  onTogglePlay,
  onWorkPlay,
  onTagClick,
}: LibraryResultsPaneProps) {
  const resultsBanner = activeSmartFolder ? (
    <div className="flex flex-col gap-2">
      {result.dataIntegrityWarning ? (
        <DataIntegrityWarningBanner skippedCount={result.dataIntegrityWarning.skippedCount} />
      ) : null}
      <SmartFolderView
        sf={activeSmartFolder}
        total={result.worksTotal}
        tagPrefixes={tagPrefixes}
        tagSuggestions={tagSuggestions}
        onEdit={onEditSmartFolderRules}
      />
    </div>
  ) : isErrorView ? (
    <ErrorViewBulkUnregisterBanner
      missingCount={missingWorksCount}
      onUnregistered={() => {
        if (selectedWork?.status === "missing") nav.selectWork(null);
      }}
    />
  ) : undefined;

  const workResultsProps: WorkResultsProps = {
    nav,
    works: result.works,
    worksQueryKey,
    isPending,
    dockedBarActive,
    onWorkPlay,
    pagination: {
      hasNextPage: result.hasNextPage,
      worksTotal: result.worksTotal,
      isFetchingNextPage: result.isFetchingNextPage,
      onLoadMore: () => void result.fetchNextPage(),
    },
    emptyState: {
      searchQuery,
      isSmartFolder: Boolean(activeSmartFolder),
      onClearSearch,
      onEditSmartFolderRules,
    },
  };

  return (
    <>
      {/* チップ列と同じ理由で .mll-results の外（.mll-resultspane の通常フロー）に置く。
          プレビューが右からスライドインしても結果面の幅が縮むだけで隠れない。 */}
      {resultsBanner}
      <div className="mll-results">
        <div className="mll-results__content">
          {showGrid ? <WorkGrid {...workResultsProps} /> : <WorkListPane {...workResultsProps} />}
        </div>

        {/* 作品選択時のみスライドイン（ADR-0012 §3）。list/grid どちらでも同じ配線。
            selectedWorkId が非nullの間だけマウントする境界にすることで、退出中も
            AnimatePresenceが凍結した最後のselectedWorkを表示し続ける（RQキャッシュへの
            暗黙依存を断つ）。 */}
        <AnimatePresence>
          {nav.selectedWorkId !== null && (
            <PreviewPaneSlide
              key="preview"
              onClose={() => nav.selectWork(null)}
              selectedWork={selectedWork}
              isSelectedWorkLoading={workDetailQuery.isPending}
              isSelectedWorkError={workDetailQuery.isError}
              onRetrySelectedWork={workDetailQuery.refetch}
              playingTrackIndex={previewActions.playingTrackIndexForSelected}
              isPlaybackActive={previewActions.isPlaybackActive}
              onPlay={previewActions.handlePlay}
              onResume={previewActions.handleResume}
              onTogglePlay={onTogglePlay}
              onTagClick={onTagClick}
              tagSuggestions={tagSuggestions}
              nav={nav}
              searchQuery={searchQuery}
              onExpand={previewActions.handleExpand}
              onGoToPlayingScreen={
                previewActions.isSelectedWorkPlaying
                  ? previewActions.handleGoToPlayingScreen
                  : undefined
              }
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
