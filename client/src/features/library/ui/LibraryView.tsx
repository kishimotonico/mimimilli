import { useCallback, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { NormalizedTag, Work, WorkListItem } from "@mimimilli/shared";
import { libraryViewModeAtom } from "../model/atoms";
import { librarySearchQueryAtom } from "../../../entities/library/model/navigationAtoms";
import { setAppModeAtom } from "../../../shared/model/appModeAtoms";
import { openWorkDetailAtom } from "../../../entities/work/model/navigationActions";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import {
  useLibraryDebouncedSearchQuery,
  useLibrarySupportingQueries,
  useMissingWorksCountQuery,
} from "../model/useLibraryQueries";
import {
  buildWorksResetKey,
  computeResultsPaneKind,
  isGridViewActive,
} from "../model/libraryPresentation";
import { isSmartAxis, getSmartFolderId } from "../../../entities/library/axisDefinitions";
import { useRootFolder } from "../../../entities/settings/useSettingsQuery";
import { useLibrarySmartFolderEditor } from "../model/useLibrarySmartFolderEditor";
import { useLibrarySelectionCleanup } from "../model/useLibrarySelectionCleanup";
import { useLibraryPreviewActions } from "../model/useLibraryPreviewActions";
import AxisColumn from "./AxisColumn";
import AxisValueList from "./AxisValueList";
import FilterChipBand from "./FilterChipBand";
import LibraryResultsPane from "./LibraryResultsPane";
import SmartFolderEditorSection from "./SmartFolderEditorSection";
import LibraryWorksBoundary from "./LibraryWorksBoundary";

interface LibraryViewProps {
  onPlay: (work: WorkListItem, trackIndex: number) => void;
  onResume: (work: Work) => void;
  /** ロード中トラックの再生/一時停止を切り替える（選択中作品が再生中のときのスプリットボタン用） */
  onTogglePlay: () => void;
  /** 画面下張り付きの再生バーが表示中か（結果面の末尾余白の確保に使う） */
  dockedBarActive: boolean;
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
  const nav = useLibraryNavigation();

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

  const isErrorView = nav.activeAxis === "error";
  const missingWorksCountQuery = useMissingWorksCountQuery(isErrorView);

  // ── 表示導出（純粋計算は model/libraryPresentation に集約） ──
  const paneKind = computeResultsPaneKind(nav.activeAxis);
  const showGrid = isGridViewActive(nav.activeAxis, viewMode);

  const activeSmartFolder = isSmartAxis(nav.activeAxis)
    ? (smartFolders.find((sf) => sf.id === getSmartFolderId(nav.activeAxis)) ?? null)
    : null;

  useLibrarySelectionCleanup({
    nav,
    isNoResultsDueToFilter,
    workDetailError: workDetailQuery.error,
  });

  const smartFolderEditor = useLibrarySmartFolderEditor({ nav, activeSmartFolder });

  const previewActions = useLibraryPreviewActions({
    selectedWork,
    rootFolder,
    onPlay,
    onResume,
    openWorkDetail,
    setAppMode,
  });

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
        onNewSmartFolder={smartFolderEditor.openNew}
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
          valueListItemCount={paneKind === "value-list" ? facetItems.length : undefined}
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
            onWorksTotalChange={setWorksTotal}
          >
            {(result, isPending) => (
              <LibraryResultsPane
                nav={nav}
                result={result}
                worksQueryKey={buildWorksResetKey({
                  activeAxis: nav.activeAxis,
                  selectedTags: nav.selectedTags,
                  sort: nav.sort,
                  searchQuery: debouncedSearchQuery,
                })}
                isPending={isPending}
                showGrid={showGrid}
                dockedBarActive={dockedBarActive}
                activeSmartFolder={activeSmartFolder}
                isErrorView={isErrorView}
                missingWorksCount={missingWorksCountQuery.data}
                tagPrefixes={tagPrefixes}
                tagSuggestions={tagSuggestions}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery("")}
                onEditSmartFolderRules={smartFolderEditor.openEdit}
                selectedWork={selectedWork}
                workDetailQuery={workDetailQuery}
                previewActions={previewActions}
                onTogglePlay={onTogglePlay}
                onWorkPlay={(work) => onPlay(work, 0)}
                onTagClick={handleTagClick}
              />
            )}
          </LibraryWorksBoundary>
        )}
      </div>

      <SmartFolderEditorSection
        editor={smartFolderEditor}
        tagSuggestions={tagSuggestions}
        tagPrefixes={tagPrefixes}
      />
    </>
  );
}
