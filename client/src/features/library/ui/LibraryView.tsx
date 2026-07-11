import { useCallback, useState } from "react";
import type { Work, WorkSummary } from "@mimimilli/shared";
import type { ViewMode } from "../model/types";
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
  searchQuery: string;
  onSearchChange: (q: string) => void;
  playingWorkId?: string;
  playingTrackIndex?: number;
  isPlaybackActive?: boolean;
  onPlay: (work: WorkSummary, trackIndex: number) => void;
  onResume: (work: Work) => void;
  viewMode: ViewMode;
  tileSize: number;
  onTileSizeChange: (size: number) => void;
}

export default function LibraryView({
  searchQuery,
  onSearchChange,
  playingWorkId,
  playingTrackIndex,
  isPlaybackActive,
  onPlay,
  onResume,
  viewMode,
  tileSize,
  onTileSizeChange,
}: LibraryViewProps) {
  const nav = useLibraryView();
  const [smartFolderEditor, setSmartFolderEditor] = useState<SmartFolderEditorState>(
    closedSmartFolderEditorState,
  );

  const {
    works,
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

  const handlePlay = useCallback(
    (trackIndex: number) => {
      if (selectedWork) {
        const summary: Parameters<typeof onPlay>[0] = {
          id: selectedWork.id,
          title: selectedWork.title,
          coverImage: selectedWork.coverImage,
          status: selectedWork.status,
          physicalPath: selectedWork.physicalPath,
          totalDurationSec: selectedWork.totalDurationSec,
          addedAt: selectedWork.addedAt,
          errorMessage: selectedWork.errorMessage,
          urls: selectedWork.urls,
          tags: selectedWork.tags,
          trackCount: selectedWork.playlists[0]?.tracks.length ?? 0,
          bookmarked: selectedWork.bookmarked,
          lastPlayedAt: selectedWork.lastPlayedAt,
        };
        onPlay(summary, trackIndex);
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
          selectedWorkId={nav.selectedWorkId}
          searchQuery={searchQuery}
          tileSize={tileSize}
          isLoading={isLoading}
          isError={isError}
          onTileSizeChange={onTileSizeChange}
          onWorkSelect={nav.selectWork}
          onWorkPlay={(work) => onPlay(work, 0)}
          onDrillBack={nav.drillBack}
          onClearSearch={() => onSearchChange("")}
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
          facetItems={facetItems}
          selectedWorkId={nav.selectedWorkId}
          selectedTags={nav.selectedTags}
          searchQuery={searchQuery}
          playingWorkId={playingWorkId}
          isPlaybackActive={isPlaybackActive}
          isLoading={isLoading}
          isError={isError}
          onWorkSelect={nav.selectWork}
          onDrillSelect={nav.drillInto}
          onDrillBack={nav.drillBack}
          onTagToggle={nav.toggleTag}
          onClearSearch={() => onSearchChange("")}
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
          smartFolderWorks={works}
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
