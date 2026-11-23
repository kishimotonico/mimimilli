import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { isHasErrorOnly, normalizeSearchQuery } from "@mimimilli/shared";
import { hasChipOrSearchRefinement } from "../../../entities/library/refinement";
import { libraryViewModeAtom } from "../model/atoms";
import { openNowPlayingLayerAtom } from "../../../entities/navigation/model/appRouteStore";
import { openWorkDetailAtom } from "../../../entities/work/model/navigationActions";
import { buildEmptyWorksMessage } from "../model/emptyWorks";
import { useLibraryNavigation, type ReadyLibraryNavigation } from "../model/useLibraryNavigation";
import {
  useLibraryDebouncedSearchQuery,
  useLibrarySupportingQueries,
  useMissingWorksCountQuery,
} from "../model/useLibraryQueries";
import { useSaveSearch } from "../model/useSaveSearch";
import { folderWorksResetKey } from "../model/folderWorksRequest";
import { useLibrarySelectionCleanup } from "../model/useLibrarySelectionCleanup";
import { useLibraryPreviewActions } from "../model/useLibraryPreviewActions";
import GroupValueList from "./GroupValueList";
import FilterChipBand from "./FilterChipBand";
import RefinementActions from "./RefinementActions";
import LibraryResultsPane from "./LibraryResultsPane";
import LibraryWorksBoundary from "./LibraryWorksBoundary";
import CollectionStatus from "../../../shared/ui/CollectionStatus";

interface LibraryViewProps {
  /** 画面下張り付きの再生バーが表示中か（結果面の末尾余白の確保に使う） */
  dockedBarActive: boolean;
}

/** スマートフォルダー一覧を取れるまで・取れなかったときは、結果面に状態を出す（サイドバーは自分で出す） */
export default function LibraryView({ dockedBarActive }: LibraryViewProps) {
  const nav = useLibraryNavigation();
  if (nav.foldersStatus === "ready") {
    return <LibraryViewBody nav={nav} dockedBarActive={dockedBarActive} />;
  }
  const isError = nav.foldersStatus === "error";
  return (
    <div className="mll-resultspane">
      <div className="mll-results">
        <div className="mll-results__content">
          <CollectionStatus
            variant="list"
            kind={isError ? "error" : "loading"}
            message={isError ? (nav.foldersError ?? undefined) : undefined}
            onRetry={isError ? nav.refetchFolders : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function LibraryViewBody({
  nav,
  dockedBarActive,
}: LibraryViewProps & { nav: ReadyLibraryNavigation }) {
  const { view } = nav;
  const searchQuery = view.q;
  const debouncedSearchQuery = useLibraryDebouncedSearchQuery(searchQuery);
  const openNowPlaying = useSetAtom(openNowPlayingLayerAtom);
  const openWorkDetail = useSetAtom(openWorkDetailAtom);
  const viewMode = useAtomValue(libraryViewModeAtom);

  const {
    groupValueItems,
    isGroupValuesLoading,
    isGroupValuesError,
    selectedWork,
    workDetailQuery,
    tagSuggestions,
    tagPrefixes,
    isTagPrefixesError,
    refetchTagPrefixes,
    refetchGroupValues,
  } = useLibrarySupportingQueries(nav, debouncedSearchQuery);
  const [noResultsKey, setNoResultsKey] = useState<string | null>(null);
  // 0件と報告された一覧が、route の今の一覧と同じときだけ「絞り込みで0件」とする。デバウンス中や
  // 戻る・進むの直後に、前の一覧の結果を引きずらない
  const isNoResultsDueToFilter =
    view.kind === "works" && noResultsKey === folderWorksResetKey(view, view.q);
  const [worksTotal, setWorksTotal] = useState<number | undefined>(undefined);

  const isErrorView = view.kind === "works" && isHasErrorOnly(view.condition);
  const missingWorksCountQuery = useMissingWorksCountQuery(isErrorView);

  const valueListEmptyState =
    view.kind === "value-list" ? buildValueListEmptyState(nav) : undefined;

  const showGrid = viewMode === "grid";
  const saveSearch = useSaveSearch(nav);

  useLibrarySelectionCleanup({
    nav,
    isNoResultsDueToFilter,
    workDetailError: workDetailQuery.error,
  });

  const previewActions = useLibraryPreviewActions({
    selectedWork,
    openWorkDetail,
    openNowPlaying,
  });

  return (
    <>
      <div className="mll-resultspane">
        {
          // チップ列は結果面の常設ヘッダーとして .mll-results の外に置く。
          // .mll-results 内側の作品プレビューは絶対配置でスライドインするため、
          // 同じ .mll-results に同居させるとプレビューの下に隠れて操作できなくなる。
          <FilterChipBand
            tagPrefixes={tagPrefixes}
            selectedTags={view.selectedTags}
            groupValueScope={{
              folderId: view.folder.id,
              group: view.kind === "works" ? view.group : null,
              tags: view.selectedTags,
              q: debouncedSearchQuery,
            }}
            onAddTag={nav.addTag}
            onRemoveTag={nav.removeTag}
            worksTotal={view.kind === "works" ? worksTotal : undefined}
            valueListItemCount={view.kind === "value-list" ? groupValueItems.length : undefined}
            save={
              saveSearch.offer
                ? {
                    offer: saveSearch.offer,
                    folderName: view.folder.name,
                    onSave: saveSearch.openSaveDialog,
                    onOverwrite: () => void saveSearch.overwrite(),
                  }
                : undefined
            }
          />
        }
        {view.kind === "value-list" ? (
          <div className="mll-results">
            <div className="mll-results__content">
              <GroupValueList
                groupBy={view.groupBy}
                sort={view.groupSort}
                onSortChange={nav.setGroupSort}
                groupValueItems={groupValueItems}
                tagPrefixes={tagPrefixes}
                isGroupValuesLoading={isGroupValuesLoading}
                isGroupValuesError={isGroupValuesError}
                isTagPrefixesError={isTagPrefixesError}
                onSelectValue={nav.selectGroupValue}
                onRetryGroupValues={refetchGroupValues}
                onRetryTagPrefixes={refetchTagPrefixes}
                emptyState={valueListEmptyState}
              />
            </div>
          </div>
        ) : (
          <LibraryWorksBoundary
            view={view}
            searchQuery={debouncedSearchQuery}
            viewMode={viewMode}
            isPending={nav.isPending}
            onNoResultsChange={setNoResultsKey}
            onWorksTotalChange={setWorksTotal}
          >
            {(result, isPending) => (
              <LibraryResultsPane
                nav={nav}
                result={result}
                worksQueryKey={folderWorksResetKey(view, debouncedSearchQuery)}
                isPending={isPending}
                showGrid={showGrid}
                dockedBarActive={dockedBarActive}
                isErrorView={isErrorView}
                missingWorksCount={missingWorksCountQuery.data}
                tagSuggestions={tagSuggestions}
                searchQuery={searchQuery}
                onClearSearch={() => nav.setSearchQuery("")}
                selectedWork={selectedWork}
                workDetailQuery={workDetailQuery}
                previewActions={previewActions}
                onTagClick={nav.clickTag}
              />
            )}
          </LibraryWorksBoundary>
        )}
      </div>
    </>
  );
}

/** 値一覧が0件のとき、絞り込みが原因なら「すべて」で探す操作などを添える */
function buildValueListEmptyState(nav: ReadyLibraryNavigation) {
  const { view } = nav;
  if (!hasChipOrSearchRefinement(view)) return undefined;
  const query = normalizeSearchQuery(view.q);
  return {
    message: buildEmptyWorksMessage(query, view.selectedTags.length > 0),
    action: (
      <RefinementActions
        folderId={view.folder.id}
        hasQuery={query !== ""}
        hasSelectedTags={view.selectedTags.length > 0}
        onSearchInAll={nav.searchInAll}
        onClearSearch={() => nav.setSearchQuery("")}
        onClearTags={nav.clearTags}
      />
    ),
  };
}
