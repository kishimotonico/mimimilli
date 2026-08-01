import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  getDefaultPlaylistTrackCount,
  toWorkListItem,
  type Work,
  type WorkListItem,
} from "@mimimilli/shared";
import { gridInspectorOpenAtom, librarySearchQueryAtom, libraryViewModeAtom } from "../model/atoms";
import {
  playerIsPlaybackActiveAtom,
  playingTrackIndexAtom,
  playingWorkIdAtom,
} from "../../player/model/atoms";
import { useLibraryView } from "../model/useLibraryNavigation";
import { useLibraryQueries, useSmartFolderMutation } from "../model/useLibraryQueries";
import {
  computeCollectionStatsDisplay,
  computeIsNoResultsDueToFilter,
  computePreviewMode,
  computeWorksListVisibility,
  shouldClearSelectionOnFilterMiss,
  shouldClearSelectionOnWorkNotFound,
} from "../model/libraryPresentation";
import { isSmartAxis, getSmartFolderId } from "../model/axisDefinitions";
import {
  type SmartFolderEditorState,
  closedSmartFolderEditorState,
  createSmartFolderEditorState,
  editSmartFolderEditorState,
} from "../model/smartFolderEditor";
import { getAxisLandingPresentation } from "../model/axisLandingPresentation";
import AxisColumn from "./AxisColumn";
import ContentColumn from "./ContentColumn";
import PreviewPane from "./PreviewPane";
import WorkGrid from "./WorkGrid";
import WorkGridInspector from "./WorkGridInspector";
import SmartFolderEditorModal from "./SmartFolderEditorModal";

interface LibraryViewProps {
  onPlay: (work: WorkListItem, trackIndex: number) => void;
  onResume: (work: Work) => void;
  /** ロード中トラックの再生/一時停止を切り替える（選択中作品が再生中のときのスプリットボタン用） */
  onTogglePlay: () => void;
}

export default function LibraryView({ onPlay, onResume, onTogglePlay }: LibraryViewProps) {
  const searchQuery = useAtomValue(librarySearchQueryAtom);
  const setSearchQuery = useSetAtom(librarySearchQueryAtom);
  const viewMode = useAtomValue(libraryViewModeAtom);
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingTrackIndex = useAtomValue(playingTrackIndexAtom);
  const isPlaybackActive = useAtomValue(playerIsPlaybackActiveAtom);
  const [gridInspectorOpen, setGridInspectorOpen] = useAtom(gridInspectorOpenAtom);
  const nav = useLibraryView();
  const [smartFolderEditor, setSmartFolderEditor] = useState<SmartFolderEditorState>(
    closedSmartFolderEditorState,
  );

  const {
    works,
    worksParams,
    isLoading,
    isError,
    libraryTotal,
    facetItems,
    isFacetLoading,
    isFacetError,
    smartFolders,
    selectedWork,
    workDetailQuery,
    tagSuggestions,
    tagPrefixes,
    isTagPrefixesError,
    refetchTagPrefixes,
    patchWorkMutation,
    hasNextPage,
    worksTotal,
    worksStats,
    isFetchingNextPage,
    fetchNextPage,
    refetchWorks,
    refetchFacets,
  } = useLibraryQueries(nav, searchQuery);

  // 未選択プレースホルダー（グリッド詳細パネル / リストのプレビュー空表示）の統計。
  // 現在表示中の works クエリと同じ絞り込みに一致させる。
  const collectionStats = computeCollectionStatsDisplay(isLoading, isError, worksTotal, worksStats);

  const saveSmartFolderMutation = useSmartFolderMutation({
    onSaved: (savedFolder, wasNew) => {
      setSmartFolderEditor(closedSmartFolderEditorState);
      if (wasNew) nav.setAxis(`smart-${savedFolder.id}`);
    },
    onError: (wasNew, error) => {
      console.error(
        wasNew
          ? "スマートフォルダーの作成に失敗しました"
          : "スマートフォルダーの更新に失敗しました",
        error,
      );
    },
  });

  // ── 表示導出（純粋計算は model/libraryPresentation に集約） ──
  const { showGrid, showsWorksList } = computeWorksListVisibility(
    nav.activeAxis,
    nav.drillValue,
    viewMode,
  );
  const isNoResultsDueToFilter = computeIsNoResultsDueToFilter(
    showsWorksList,
    works.length,
    searchQuery,
    nav.activeAxis,
    nav.drillValue,
    isLoading,
    isError,
  );
  const previewMode = computePreviewMode({
    isNoResultsDueToFilter,
    selectedWorkId: nav.selectedWorkId,
    activeAxis: nav.activeAxis,
    drillValue: nav.drillValue,
    selectedTags: nav.selectedTags,
  });
  const isAxisFilterApplied = nav.activeAxis === "tag" && nav.selectedTags.length > 0;

  // 検索・ドリルの絞り込みで作品一覧が0件になったら、含まれなくなった選択中の
  // 作品詳細が残らないよう選択を解除する。
  useEffect(() => {
    if (shouldClearSelectionOnFilterMiss(isNoResultsDueToFilter, nav.selectedWorkId)) {
      nav.selectWork(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav は毎レンダー新規オブジェクトのため参照する値だけに依存を絞る
  }, [isNoResultsDueToFilter, nav.selectedWorkId, nav.selectWork]);

  // 存在しない work= パラメータ（削除済み作品など）で開いた場合、404を確認したら
  // 選択を解除してURLをクリーンアップする。404以外（ネットワーク断・5xx等の一時的な
  // 失敗）では選択を維持し、パネル側でエラー表示・再試行を出す（workDetailQuery.isPending/
  // isError はワークグリッドインスペクタ／PreviewPaneへそのまま渡す）。
  useEffect(() => {
    if (shouldClearSelectionOnWorkNotFound(nav.selectedWorkId, workDetailQuery.error)) {
      nav.selectWork(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav は毎レンダー新規オブジェクトのため参照する値だけに依存を絞る
  }, [nav.selectedWorkId, workDetailQuery.error, nav.selectWork]);

  const activeSmartFolder = isSmartAxis(nav.activeAxis)
    ? (smartFolders.find((sf) => sf.id === getSmartFolderId(nav.activeAxis)) ?? null)
    : null;

  // 検索・軸・ソート・タグ・ドリル変更時にグリッド/リストのスクロール位置を
  // リセットするための key。ページ追加（useInfiniteQuery）時は worksParams が
  // 変わらないのでリセットしない（TASK-59）。
  const worksQueryKey = useMemo(() => {
    if (isSmartAxis(nav.activeAxis)) {
      return JSON.stringify({
        type: "smart",
        id: getSmartFolderId(nav.activeAxis),
        sort: nav.sort,
      });
    }
    return JSON.stringify({
      type: "works",
      params: worksParams,
    });
  }, [nav.activeAxis, nav.sort, worksParams]);

  const handlePlay = useCallback(
    (trackIndex: number) => {
      if (selectedWork) {
        onPlay(
          toWorkListItem({
            ...selectedWork,
            trackCount: getDefaultPlaylistTrackCount(selectedWork),
          }),
          trackIndex,
        );
      }
    },
    [selectedWork, onPlay],
  );

  const handleResume = useCallback(() => {
    if (selectedWork) onResume(selectedWork);
  }, [selectedWork, onResume]);

  // タグチップクリック → タグ軸へ遷移し、そのタグだけを選択した AND 絞り込み状態にする
  const handleTagClick = useCallback(
    (tag: string) => {
      nav.setAxis("tag");
      nav.toggleTag(tag);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav は毎レンダー新規オブジェクトのため参照する値だけに依存を絞る
    [nav.setAxis, nav.toggleTag],
  );

  return (
    <>
      <AxisColumn
        activeAxis={nav.activeAxis}
        totalCount={libraryTotal}
        tagPrefixes={tagPrefixes}
        isTagPrefixesError={isTagPrefixesError}
        onRetryTagPrefixes={refetchTagPrefixes}
        smartFolders={smartFolders}
        onSelectAxis={nav.setAxis}
        onNewSmartFolder={() => {
          saveSmartFolderMutation.reset();
          setSmartFolderEditor(createSmartFolderEditorState);
        }}
      />

      {showGrid ? (
        <WorkGrid
          axis={nav.activeAxis}
          drillValue={nav.drillValue}
          works={works}
          tagPrefixes={tagPrefixes}
          worksQueryKey={worksQueryKey}
          selectedWorkId={nav.selectedWorkId}
          searchQuery={searchQuery}
          playingWorkId={playingWorkId}
          isPlaybackActive={isPlaybackActive}
          isLoading={isLoading}
          isError={isError}
          onRetryWorks={refetchWorks}
          hasNextPage={hasNextPage}
          worksTotal={worksTotal}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
          onWorkSelect={nav.selectWork}
          onWorkPlay={(work) => onPlay(work, 0)}
          onDrillBack={nav.drillBack}
          onClearSearch={() => setSearchQuery("")}
          onDeselect={() => nav.selectWork(null)}
          inspector={
            gridInspectorOpen ? (
              <WorkGridInspector
                hasSelection={nav.selectedWorkId !== null}
                work={selectedWork}
                isLoading={workDetailQuery.isPending}
                isError={workDetailQuery.isError}
                onRetry={workDetailQuery.refetch}
                collectionStats={collectionStats}
                playingTrackIndex={
                  selectedWork && playingWorkId === selectedWork.id
                    ? (playingTrackIndex ?? null)
                    : null
                }
                isPlaybackActive={isPlaybackActive}
                tagSuggestions={tagSuggestions}
                isPatching={patchWorkMutation.isPending}
                onClose={() => setGridInspectorOpen(false)}
                onPlay={handlePlay}
                onResume={handleResume}
                onTogglePlay={onTogglePlay}
                onTagClick={handleTagClick}
                onPatchWork={(body) => {
                  if (!selectedWork) {
                    return Promise.reject(new Error("更新対象の作品が選択されていません"));
                  }
                  return patchWorkMutation.mutateAsync({ workId: selectedWork.id, body });
                }}
              />
            ) : null
          }
        />
      ) : (
        <ContentColumn
          axis={nav.activeAxis}
          works={works}
          worksQueryKey={worksQueryKey}
          facetItems={facetItems}
          tagPrefixes={tagPrefixes}
          selectedWorkId={nav.selectedWorkId}
          selectedTags={nav.selectedTags}
          searchQuery={searchQuery}
          playingWorkId={playingWorkId}
          isPlaybackActive={isPlaybackActive}
          isLoading={isLoading}
          isError={isError}
          isFacetLoading={isFacetLoading}
          isFacetError={isFacetError}
          isTagPrefixesError={isTagPrefixesError}
          hasNextPage={hasNextPage}
          worksTotal={worksTotal}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
          onWorkSelect={nav.selectWork}
          onDrillSelect={nav.drillInto}
          onTagToggle={nav.toggleTag}
          onClearSearch={() => setSearchQuery("")}
          onRetryWorks={refetchWorks}
          onRetryFacets={refetchFacets}
          onRetryTagPrefixes={refetchTagPrefixes}
        />
      )}

      {!showGrid && (
        <PreviewPane
          mode={previewMode}
          showNoResultsHint={isNoResultsDueToFilter}
          emptyStats={collectionStats}
          axisLandingPresentation={getAxisLandingPresentation(
            nav.activeAxis,
            isAxisFilterApplied,
            tagPrefixes,
          )}
          selectedWork={selectedWork}
          isSelectedWorkLoading={workDetailQuery.isPending}
          isSelectedWorkError={workDetailQuery.isError}
          onRetrySelectedWork={workDetailQuery.refetch}
          smartFolder={activeSmartFolder}
          axisWorks={works}
          axisTotal={worksTotal}
          smartFolderWorks={works}
          smartFolderTotal={worksTotal}
          playingTrackIndex={
            selectedWork && playingWorkId === selectedWork.id ? (playingTrackIndex ?? null) : null
          }
          isPlaybackActive={isPlaybackActive}
          onPlay={handlePlay}
          onResume={handleResume}
          onTogglePlay={onTogglePlay}
          onSelectWork={nav.selectWork}
          onTagClick={handleTagClick}
          tagSuggestions={tagSuggestions}
          isPatching={patchWorkMutation.isPending}
          onPatchWork={(body) => {
            if (!selectedWork) {
              return Promise.reject(new Error("更新対象の作品が選択されていません"));
            }
            return patchWorkMutation.mutateAsync({ workId: selectedWork.id, body });
          }}
          onEditSmartFolder={(folder) => {
            saveSmartFolderMutation.reset();
            setSmartFolderEditor(editSmartFolderEditorState(folder));
          }}
        />
      )}

      {smartFolderEditor.status !== "closed" && (
        <SmartFolderEditorModal
          folder={smartFolderEditor.status === "edit" ? smartFolderEditor.folder : null}
          tagSuggestions={tagSuggestions}
          isSaving={saveSmartFolderMutation.isPending}
          saveError={
            saveSmartFolderMutation.error instanceof Error
              ? saveSmartFolderMutation.error.message
              : saveSmartFolderMutation.error
                ? "保存に失敗しました"
                : null
          }
          onClose={() => {
            if (saveSmartFolderMutation.isPending) return;
            setSmartFolderEditor(closedSmartFolderEditorState);
          }}
          onSave={(input) =>
            saveSmartFolderMutation.mutate({
              folder: smartFolderEditor.status === "edit" ? smartFolderEditor.folder : null,
              input,
            })
          }
        />
      )}
    </>
  );
}
