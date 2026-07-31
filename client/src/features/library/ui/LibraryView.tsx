import { useCallback, useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  getDefaultPlaylistTrackCount,
  toWorkListItem,
  type Work,
  type WorkListItem,
} from "@mimimilli/shared";
import { librarySearchQueryAtom, libraryViewModeAtom } from "../model/atoms";
import {
  playerIsPlaybackActiveAtom,
  playingTrackIndexAtom,
  playingWorkIdAtom,
} from "../../player/model/atoms";
import { useLibraryView } from "../model/useLibraryNavigation";
import { useLibraryQueries, useSmartFolderMutation } from "../model/useLibraryQueries";
import {
  computeIsNoResultsDueToFilter,
  computePreviewMode,
  computeWorksListVisibility,
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
}

export default function LibraryView({ onPlay, onResume }: LibraryViewProps) {
  const searchQuery = useAtomValue(librarySearchQueryAtom);
  const setSearchQuery = useSetAtom(librarySearchQueryAtom);
  const viewMode = useAtomValue(libraryViewModeAtom);
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingTrackIndex = useAtomValue(playingTrackIndexAtom);
  const isPlaybackActive = useAtomValue(playerIsPlaybackActiveAtom);
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
    smartFolders,
    selectedWork,
    workDetailQuery,
    tagSuggestions,
    tagPrefixes,
    patchWorkMutation,
    hasNextPage,
    worksTotal,
    isFetchingNextPage,
    fetchNextPage,
  } = useLibraryQueries(nav, searchQuery);

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
  );
  const previewMode = computePreviewMode({
    isNoResultsDueToFilter,
    selectedWorkId: nav.selectedWorkId,
    hasSelectedWork: selectedWork !== null,
    activeAxis: nav.activeAxis,
    drillValue: nav.drillValue,
    selectedTags: nav.selectedTags,
  });
  const isAxisFilterApplied = nav.activeAxis === "tag" && nav.selectedTags.length > 0;

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

  return (
    <>
      <AxisColumn
        activeAxis={nav.activeAxis}
        totalCount={libraryTotal}
        tagPrefixes={tagPrefixes}
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
          isLoading={isLoading}
          isError={isError}
          hasNextPage={hasNextPage}
          worksTotal={worksTotal}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
          onWorkSelect={nav.selectWork}
          onWorkPlay={(work) => onPlay(work, 0)}
          onDrillBack={nav.drillBack}
          onClearSearch={() => setSearchQuery("")}
          onInspectorClose={() => nav.selectWork(null)}
          inspector={
            nav.selectedWorkId ? (
              <WorkGridInspector
                work={selectedWork}
                isLoading={workDetailQuery.isPending}
                isError={workDetailQuery.isError}
                playingTrackIndex={
                  selectedWork && playingWorkId === selectedWork.id
                    ? (playingTrackIndex ?? null)
                    : null
                }
                isPlaybackActive={isPlaybackActive}
                tagSuggestions={tagSuggestions}
                isPatching={patchWorkMutation.isPending}
                onClose={() => nav.selectWork(null)}
                onPlay={handlePlay}
                onResume={handleResume}
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
          drillValue={nav.drillValue}
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
          hasNextPage={hasNextPage}
          worksTotal={worksTotal}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
          onWorkSelect={nav.selectWork}
          onDrillSelect={nav.drillInto}
          onDrillBack={nav.drillBack}
          onTagToggle={nav.toggleTag}
          onClearSearch={() => setSearchQuery("")}
        />
      )}

      {!showGrid && (
        <PreviewPane
          mode={previewMode}
          showNoResultsHint={isNoResultsDueToFilter}
          axisLandingPresentation={getAxisLandingPresentation(
            nav.activeAxis,
            isAxisFilterApplied,
            tagPrefixes,
          )}
          selectedWork={selectedWork}
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
          onSelectWork={nav.selectWork}
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
