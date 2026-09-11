import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import {
  getDefaultPlaylistTrackCount,
  toWorkListItem,
  type NormalizedTag,
  type Work,
  type WorkListItem,
} from "@mimimilli/shared";
import { libraryInvalidUrlToastAtom, libraryViewModeAtom } from "../model/atoms";
import { librarySearchQueryAtom } from "../../../entities/library/model/navigationAtoms";
import { setAppModeAtom } from "../../../shared/model/appModeAtoms";
import { openWorkDetailAtom } from "../../../entities/work/model/navigationActions";
import { recoverInvalidLibraryAxisAtom } from "../../../entities/library/model/navigationActions";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { listSmartFolders } from "../../../entities/smart-folder/api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import {
  playerIsPlayingOrLoadingAtom,
  playingTrackIndexAtom,
  playingWorkIdAtom,
} from "../../../entities/player/model/atoms";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import {
  useLibraryBulkUnregisterMissingMutation,
  useLibraryDebouncedSearchQuery,
  useLibrarySupportingQueries,
  useMissingWorksCountQuery,
  useSmartFolderDeleteMutation,
  useSmartFolderMutation,
} from "../model/useLibraryQueries";
import {
  computeResultsPaneKind,
  isGridViewActive,
  shouldClearSelectionOnFilterMiss,
  shouldClearSelectionOnWorkNotFound,
} from "../model/libraryPresentation";
import { isSmartAxis, getSmartFolderId } from "../../../entities/library/axisDefinitions";
import { resolveInvalidLibraryAxisMessage } from "../model/libraryUrlRecovery";
import { useRootFolder } from "../../../entities/settings/useSettingsQuery";
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
import { DataIntegrityWarningBanner } from "./DataIntegrityWarningBanner";
import { ErrorViewBulkUnregisterBanner } from "./ErrorViewBulkUnregisterBanner";
import LibraryWorksBoundary from "./LibraryWorksBoundary";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";

interface LibraryViewProps {
  onPlay: (work: WorkListItem, trackIndex: number) => void;
  onResume: (work: Work) => void;
  /** ロード中トラックの再生/一時停止を切り替える（選択中作品が再生中のときのスプリットボタン用） */
  onTogglePlay: () => void;
  /** 画面下張り付きの再生バーが表示中か（結果面の末尾余白の確保に使う） */
  dockedBarActive: boolean;
}

type PreviewPaneSlideProps = ComponentProps<typeof PreviewPane>;

/** 作品選択プレビューが右から出入りする（ADR-0012 §3）。selectedWorkId が非nullの間だけ
 *  マウントされ、退出中もAnimatePresenceが凍結した最後のpropsのまま表示され続ける。 */
function PreviewPaneSlide(props: PreviewPaneSlideProps) {
  const { previewSlide } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = previewSlide();
  return (
    <motion.div className="mll-results__preview" inert={!isPresent} {...v}>
      <PreviewPane {...props} />
    </motion.div>
  );
}

export default function LibraryView({
  onPlay,
  onResume,
  onTogglePlay,
  dockedBarActive,
}: LibraryViewProps) {
  const rootFolder = useRootFolder();
  const searchQuery = useAtomValue(librarySearchQueryAtom);
  const debouncedSearchQuery = useLibraryDebouncedSearchQuery(searchQuery);
  const setSearchQuery = useSetAtom(librarySearchQueryAtom);
  const setAppMode = useSetAtom(setAppModeAtom);
  const openWorkDetail = useSetAtom(openWorkDetailAtom);
  const viewMode = useAtomValue(libraryViewModeAtom);
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingTrackIndex = useAtomValue(playingTrackIndexAtom);
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);
  const nav = useLibraryNavigation();
  const [smartFolderEditor, setSmartFolderEditor] = useState<SmartFolderEditorState>(
    closedSmartFolderEditorState,
  );

  const {
    errorViewCount,
    libraryStats,
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
  const [isNoResultsDueToFilter, setIsNoResultsDueToFilter] = useState(false);
  const [worksTotal, setWorksTotal] = useState<number | undefined>(undefined);

  // 無効な軸URLの検証専用（TASK-428.15）。tagPrefixes/smartFoldersは上と同じ
  // queryKeyでキャッシュを共有するため、追加のリクエストは発生しない。
  // isSuccessだけをここから取り、ロード中・取得失敗中を未登録と誤判定しないようにする。
  const tagPrefixesStatusQuery = useTagPrefixes();
  const smartFoldersStatusQuery = useQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.all(),
    queryFn: listSmartFolders,
  });
  const recoverInvalidLibraryAxis = useSetAtom(recoverInvalidLibraryAxisAtom);
  const setLibraryInvalidUrlToast = useSetAtom(libraryInvalidUrlToastAtom);

  const saveSmartFolderMutation = useSmartFolderMutation({
    onSaved: (savedFolder, wasNew) => {
      setSmartFolderEditor(closedSmartFolderEditorState);
      if (wasNew) nav.setAxis(`smart-${savedFolder.id}`);
    },
    onError: () => {},
  });

  const deleteSmartFolderMutation = useSmartFolderDeleteMutation({
    onDeleted: () => {
      setSmartFolderEditor(closedSmartFolderEditorState);
      nav.setAxis("all");
    },
  });

  const isErrorView = nav.activeAxis === "error";
  const missingWorksCountQuery = useMissingWorksCountQuery(isErrorView);
  const bulkUnregisterMissingMutation = useLibraryBulkUnregisterMissingMutation(() => {
    if (selectedWork?.status === "missing") nav.selectWork(null);
  });

  // ── 表示導出（純粋計算は model/libraryPresentation に集約） ──
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

  // 未登録軸・存在しないスマートフォルダーIDのURLを0件の偽ページにせず、警告付きで
  // 既定一覧へ戻す（TASK-428.15、監査所見 smart-folders-B-15）。判定自体は
  // resolveInvalidLibraryAxisMessage（純粋関数）に委ね、取得中・取得失敗中は
  // 判定不能として何もしない（一時的なネットワーク不調で正当なURLを弾かない）。
  // 既定一覧へは履歴を積まず現在のエントリを置き換える（recoverInvalidLibraryAxisAtom）
  // ため、「戻る」で無効なURLへ再度入ることはない。
  useEffect(() => {
    const message = resolveInvalidLibraryAxisMessage(
      nav.activeAxis,
      tagPrefixesStatusQuery.isSuccess,
      smartFoldersStatusQuery.isSuccess,
      tagPrefixes,
      smartFolders,
    );
    if (!message) return;
    recoverInvalidLibraryAxis();
    setLibraryInvalidUrlToast(message);
  }, [
    nav.activeAxis,
    tagPrefixes,
    smartFolders,
    tagPrefixesStatusQuery.isSuccess,
    smartFoldersStatusQuery.isSuccess,
    recoverInvalidLibraryAxis,
    setLibraryInvalidUrlToast,
  ]);

  const handlePlay = useCallback(
    (trackIndex: number) => {
      if (selectedWork && rootFolder !== null) {
        onPlay(
          toWorkListItem(
            {
              ...selectedWork,
              trackCount: getDefaultPlaylistTrackCount(selectedWork),
            },
            rootFolder,
          ),
          trackIndex,
        );
      }
    },
    [selectedWork, rootFolder, onPlay],
  );

  const handleResume = useCallback(() => {
    if (selectedWork) onResume(selectedWork);
  }, [selectedWork, onResume]);

  const handleExpand = useCallback(() => {
    if (selectedWork) openWorkDetail(selectedWork.id);
  }, [selectedWork, openWorkDetail]);

  const handleGoToPlayingScreen = useCallback(() => setAppMode("nowPlaying"), [setAppMode]);

  // タグチップクリック → replaceTagと同一挙動（ADR-0013）。Ctrl/Cmd+クリックは
  // AND追加（addLibraryTagAtom相当）へ反転する。
  const handleTagClick = useCallback(
    (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => {
      if (opts.ctrlKey || opts.metaKey) nav.addTag(tag);
      else nav.replaceTag(tag);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav は毎レンダー新規オブジェクトのため参照する値だけに依存を絞る
    [nav.addTag, nav.replaceTag],
  );

  const handleEditSmartFolder = useCallback(() => {
    if (!activeSmartFolder) return;
    saveSmartFolderMutation.reset();
    deleteSmartFolderMutation.reset();
    setSmartFolderEditor(editSmartFolderEditorState(activeSmartFolder));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset系は毎レンダー新規参照のため省く
  }, [activeSmartFolder]);

  return (
    <>
      <AxisColumn
        activeAxis={nav.activeAxis}
        tagPrefixes={tagPrefixes}
        isTagPrefixesError={isTagPrefixesError}
        onRetryTagPrefixes={refetchTagPrefixes}
        smartFolders={smartFolders}
        selectedTags={nav.selectedTags}
        errorViewCount={errorViewCount}
        stats={libraryStats}
        onSelectAxis={nav.setAxis}
        onToggleTag={nav.toggleTag}
        onReplaceTag={nav.replaceTag}
        onAddTag={nav.addTag}
        onNewSmartFolder={() => {
          saveSmartFolderMutation.reset();
          setSmartFolderEditor(createSmartFolderEditorState);
        }}
      />

      <div className="mll-resultspane">
        {/* チップ列は結果面の常設ヘッダーとして .mll-results の外に置く。
            .mll-results 内側の作品プレビューは絶対配置でスライドインするため、
            同じ .mll-results に同居させるとプレビューの下に隠れて操作できなくなる。 */}
        <FilterChipBand
          tagPrefixes={tagPrefixes}
          selectedTags={nav.selectedTags}
          smartFolderId={activeSmartFolder?.id}
          onReplace={nav.replaceTag}
          onToggle={nav.toggleTag}
          onAddTag={nav.addTag}
          onClearAll={nav.clearTags}
          worksTotal={paneKind === "value-list" ? undefined : worksTotal}
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
                onAddTag={nav.addTag}
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
            onWorksTotalChange={setWorksTotal}
          >
            {(result, isPending) => {
              const worksQueryKey = JSON.stringify({
                axis: nav.activeAxis,
                params: result.worksParams,
              });
              const resultsBanner = activeSmartFolder ? (
                <div className="flex flex-col gap-2">
                  {result.dataIntegrityWarning ? (
                    <DataIntegrityWarningBanner
                      skippedCount={result.dataIntegrityWarning.skippedCount}
                    />
                  ) : null}
                  <SmartFolderView
                    sf={activeSmartFolder}
                    total={result.worksTotal}
                    tagPrefixes={tagPrefixes}
                    tagSuggestions={tagSuggestions}
                    onEdit={handleEditSmartFolder}
                  />
                </div>
              ) : isErrorView ? (
                <ErrorViewBulkUnregisterBanner
                  missingCount={missingWorksCountQuery.data}
                  mutation={bulkUnregisterMissingMutation}
                />
              ) : undefined;
              return (
                <>
                  {/* チップ列と同じ理由で .mll-results の外（.mll-resultspane の通常フロー）に置く。
                      プレビューが右からスライドインしても結果面の幅が縮むだけで隠れない。 */}
                  {resultsBanner}
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
                          dockedBarActive={dockedBarActive}
                          hasNextPage={result.hasNextPage}
                          worksTotal={result.worksTotal}
                          isFetchingNextPage={result.isFetchingNextPage}
                          onLoadMore={() => void result.fetchNextPage()}
                          isPending={isPending}
                          onWorkSelect={nav.selectWork}
                          onWorkPlay={(work) => onPlay(work, 0)}
                          onClearSearch={() => setSearchQuery("")}
                          onDeselect={() => nav.selectWork(null)}
                          isSmartFolder={Boolean(activeSmartFolder)}
                          onEditSmartFolderRules={handleEditSmartFolder}
                          onClearAllFilters={nav.clearTags}
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
                          dockedBarActive={dockedBarActive}
                          isPending={isPending}
                          hasNextPage={result.hasNextPage}
                          worksTotal={result.worksTotal}
                          isFetchingNextPage={result.isFetchingNextPage}
                          onLoadMore={() => void result.fetchNextPage()}
                          onWorkSelect={nav.selectWork}
                          onWorkPlay={(work) => onPlay(work, 0)}
                          onClearSearch={() => setSearchQuery("")}
                          onDeselect={() => nav.selectWork(null)}
                          isSmartFolder={Boolean(activeSmartFolder)}
                          onEditSmartFolderRules={handleEditSmartFolder}
                          onClearAllFilters={nav.clearTags}
                        />
                      )}
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
                          playingTrackIndex={
                            selectedWork && playingWorkId === selectedWork.id
                              ? (playingTrackIndex ?? null)
                              : null
                          }
                          isPlaybackActive={isPlaybackActive}
                          onPlay={handlePlay}
                          onResume={handleResume}
                          onTogglePlay={onTogglePlay}
                          onTagClick={handleTagClick}
                          tagSuggestions={tagSuggestions}
                          nav={nav}
                          searchQuery={searchQuery}
                          onExpand={handleExpand}
                          onGoToPlayingScreen={
                            selectedWork && playingWorkId === selectedWork.id
                              ? handleGoToPlayingScreen
                              : undefined
                          }
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </>
              );
            }}
          </LibraryWorksBoundary>
        )}
      </div>

      {smartFolderEditor.status !== "closed" && (
        <SmartFolderEditorModal
          folder={smartFolderEditor.status === "edit" ? smartFolderEditor.folder : null}
          tagSuggestions={tagSuggestions}
          tagPrefixes={tagPrefixes}
          isSaving={saveSmartFolderMutation.isPending}
          saveError={
            saveSmartFolderMutation.error instanceof Error
              ? saveSmartFolderMutation.error.message
              : saveSmartFolderMutation.error
                ? "保存に失敗しました"
                : null
          }
          isDeleting={deleteSmartFolderMutation.isPending}
          deleteError={
            deleteSmartFolderMutation.error instanceof Error
              ? deleteSmartFolderMutation.error.message
              : deleteSmartFolderMutation.error
                ? "削除に失敗しました"
                : null
          }
          onClose={() => {
            if (saveSmartFolderMutation.isPending || deleteSmartFolderMutation.isPending) return;
            setSmartFolderEditor(closedSmartFolderEditorState);
          }}
          onSave={(input) =>
            saveSmartFolderMutation.mutate({
              folder: smartFolderEditor.status === "edit" ? smartFolderEditor.folder : null,
              input,
            })
          }
          onDelete={
            smartFolderEditor.status === "edit"
              ? () => deleteSmartFolderMutation.mutate(smartFolderEditor.folder.id)
              : undefined
          }
        />
      )}
    </>
  );
}
