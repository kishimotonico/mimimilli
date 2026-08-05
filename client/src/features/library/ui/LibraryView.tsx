import { useCallback, useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  getDefaultPlaylistTrackCount,
  toWorkListItem,
  type NormalizedTag,
  type Work,
  type WorkListItem,
} from "@mimimilli/shared";
import { librarySearchQueryAtom, libraryViewModeAtom } from "../model/atoms";
import {
  playerIsPlaybackActiveAtom,
  playingTrackIndexAtom,
  playingWorkIdAtom,
} from "../../player/model/atoms";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import {
  useLibraryPatchWorkMutation,
  useLibraryDebouncedSearchQuery,
  useLibrarySupportingQueries,
  useSmartFolderMutation,
} from "../model/useLibraryQueries";
import {
  computeResultsPaneKind,
  isGridViewActive,
  shouldClearSelectionOnFilterMiss,
  shouldClearSelectionOnWorkNotFound,
} from "../model/libraryPresentation";
import { isHomeAxis, isSmartAxis, getSmartFolderId } from "../model/axisDefinitions";
import {
  type SmartFolderEditorState,
  closedSmartFolderEditorState,
  createSmartFolderEditorState,
  editSmartFolderEditorState,
} from "../model/smartFolderEditor";
import AxisColumn from "./AxisColumn";
import AxisValueList from "./AxisValueList";
import FilterChipBand from "./FilterChipBand";
import PreviewPane from "./PreviewPane";
import WorkGrid from "./WorkGrid";
import WorkListPane from "./WorkListPane";
import SmartFolderEditorModal from "./SmartFolderEditorModal";
import { SmartFolderView } from "./preview/SmartFolderView";
import LibraryWorksBoundary from "./LibraryWorksBoundary";
import Presence from "../../../shared/ui/Presence";

interface LibraryViewProps {
  onPlay: (work: WorkListItem, trackIndex: number) => void;
  onResume: (work: Work) => void;
  /** ロード中トラックの再生/一時停止を切り替える（選択中作品が再生中のときのスプリットボタン用） */
  onTogglePlay: () => void;
}

export default function LibraryView({ onPlay, onResume, onTogglePlay }: LibraryViewProps) {
  const searchQuery = useAtomValue(librarySearchQueryAtom);
  const debouncedSearchQuery = useLibraryDebouncedSearchQuery(searchQuery);
  const setSearchQuery = useSetAtom(librarySearchQueryAtom);
  const viewMode = useAtomValue(libraryViewModeAtom);
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingTrackIndex = useAtomValue(playingTrackIndexAtom);
  const isPlaybackActive = useAtomValue(playerIsPlaybackActiveAtom);
  const nav = useLibraryNavigation();
  const [smartFolderEditor, setSmartFolderEditor] = useState<SmartFolderEditorState>(
    closedSmartFolderEditorState,
  );

  const {
    libraryTotal,
    homeStats,
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
    refetchFacets,
  } = useLibrarySupportingQueries(nav);
  const patchWorkMutation = useLibraryPatchWorkMutation(nav, searchQuery);
  const [isNoResultsDueToFilter, setIsNoResultsDueToFilter] = useState(false);

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
  const isHome = isHomeAxis(nav.activeAxis);
  const paneKind = computeResultsPaneKind(nav.activeAxis);
  const showGrid = isGridViewActive(nav.activeAxis, viewMode);

  // 検索・タグフィルタの絞り込みで作品一覧が0件になったら、含まれなくなった選択中の
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
  // isError は PreviewPane へそのまま渡す）。
  useEffect(() => {
    if (shouldClearSelectionOnWorkNotFound(nav.selectedWorkId, workDetailQuery.error)) {
      nav.selectWork(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav は毎レンダー新規オブジェクトのため参照する値だけに依存を絞る
  }, [nav.selectedWorkId, workDetailQuery.error, nav.selectWork]);

  const activeSmartFolder = isSmartAxis(nav.activeAxis)
    ? (smartFolders.find((sf) => sf.id === getSmartFolderId(nav.activeAxis)) ?? null)
    : null;

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

  // タグチップクリック → タグ軸へ遷移し、そのタグだけを選択した絞り込み状態にする
  const handleTagClick = useCallback(
    (tag: NormalizedTag) => {
      nav.selectSoleTag(tag);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav は毎レンダー新規オブジェクトのため参照する値だけに依存を絞る
    [nav.selectSoleTag],
  );

  const handleEditSmartFolder = useCallback(() => {
    if (!activeSmartFolder) return;
    saveSmartFolderMutation.reset();
    setSmartFolderEditor(editSmartFolderEditorState(activeSmartFolder));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveSmartFolderMutation.reset は毎レンダー新規参照のため省く
  }, [activeSmartFolder]);

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

      {isHome ? (
        <PreviewPane
          mode={nav.selectedWorkId !== null ? "work" : "home"}
          homeStats={homeStats}
          selectedWork={selectedWork}
          isSelectedWorkLoading={workDetailQuery.isPending}
          isSelectedWorkError={workDetailQuery.isError}
          onRetrySelectedWork={workDetailQuery.refetch}
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
        />
      ) : (
        <div className="mll-resultspane">
          {/* チップ列は結果面の常設ヘッダーとして .mll-results の外に置く。
              .mll-results 内側の作品プレビューは絶対配置でスライドインするため、
              同じ .mll-results に同居させるとプレビューの下に隠れて操作できなくなる。 */}
          <FilterChipBand
            tagPrefixes={tagPrefixes}
            selectedTags={nav.selectedTags}
            onReplace={nav.replaceTag}
            onToggle={nav.toggleTag}
            onClearAll={nav.clearTags}
          />
          {paneKind === "value-list" ? (
            <div className="mll-results">
              <div className="mll-results__content">
                <AxisValueList
                  axis={nav.activeAxis}
                  facetItems={facetItems}
                  tagPrefixes={tagPrefixes}
                  selectedTags={nav.selectedTags}
                  isFacetLoading={isFacetLoading}
                  isFacetError={isFacetError}
                  isTagPrefixesError={isTagPrefixesError}
                  onReplace={nav.replaceTag}
                  onToggle={nav.toggleTag}
                  onRetryFacets={refetchFacets}
                  onRetryTagPrefixes={refetchTagPrefixes}
                />
              </div>
            </div>
          ) : (
            <LibraryWorksBoundary
              nav={nav}
              searchQuery={debouncedSearchQuery}
              viewMode={viewMode}
              isPending={nav.isPending}
              onNoResultsChange={setIsNoResultsDueToFilter}
            >
              {(result, isPending) => {
                const worksQueryKey = JSON.stringify({
                  axis: nav.activeAxis,
                  params: result.worksParams,
                });
                const smartFolderBanner = activeSmartFolder ? (
                  <SmartFolderView
                    sf={activeSmartFolder}
                    total={result.worksTotal}
                    onEdit={handleEditSmartFolder}
                  />
                ) : undefined;
                return (
                  <div className="mll-results">
                    <div className="mll-results__content">
                      {showGrid ? (
                        <WorkGrid
                          axis={nav.activeAxis}
                          works={result.works}
                          worksQueryKey={worksQueryKey}
                          selectedWorkId={nav.selectedWorkId}
                          searchQuery={searchQuery}
                          hasSelectedTags={nav.selectedTags.length > 0}
                          playingWorkId={playingWorkId}
                          isPlaybackActive={isPlaybackActive}
                          isLoading={false}
                          isError={false}
                          onRetryWorks={result.refetchWorks}
                          hasNextPage={result.hasNextPage}
                          worksTotal={result.worksTotal}
                          isFetchingNextPage={result.isFetchingNextPage}
                          onLoadMore={() => void result.fetchNextPage()}
                          isPending={isPending}
                          onWorkSelect={nav.selectWork}
                          onWorkPlay={(work) => onPlay(work, 0)}
                          onClearSearch={() => setSearchQuery("")}
                          onDeselect={() => nav.selectWork(null)}
                          smartFolderBanner={smartFolderBanner}
                        />
                      ) : (
                        <WorkListPane
                          axis={nav.activeAxis}
                          works={result.works}
                          worksQueryKey={worksQueryKey}
                          selectedWorkId={nav.selectedWorkId}
                          searchQuery={searchQuery}
                          hasSelectedTags={nav.selectedTags.length > 0}
                          playingWorkId={playingWorkId}
                          isPlaybackActive={isPlaybackActive}
                          isPending={isPending}
                          hasNextPage={result.hasNextPage}
                          worksTotal={result.worksTotal}
                          isFetchingNextPage={result.isFetchingNextPage}
                          onLoadMore={() => void result.fetchNextPage()}
                          onWorkSelect={nav.selectWork}
                          onClearSearch={() => setSearchQuery("")}
                          smartFolderBanner={smartFolderBanner}
                        />
                      )}
                    </div>

                    {/* 作品選択時のみスライドイン（ADR-0012 §3）。list/grid どちらでも同じ配線。 */}
                    <Presence
                      show={nav.selectedWorkId !== null}
                      variant="preview-slide"
                      className="mll-results__preview"
                    >
                      <PreviewPane
                        mode="work"
                        homeStats={homeStats}
                        selectedWork={selectedWork}
                        isSelectedWorkLoading={workDetailQuery.isPending}
                        isSelectedWorkError={workDetailQuery.isError}
                        onRetrySelectedWork={workDetailQuery.refetch}
                        playingTrackIndex={
                          selectedWork && playingWorkId === selectedWork.id
                            ? (playingTrackIndex ?? null)
                            : null
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
                      />
                    </Presence>
                  </div>
                );
              }}
            </LibraryWorksBoundary>
          )}
        </div>
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
