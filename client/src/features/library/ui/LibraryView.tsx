import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { isHasErrorOnly } from "@mimimilli/shared";
import { libraryViewModeAtom } from "../model/atoms";
import { setAppModeAtom } from "../../../entities/navigation/model/appRouteStore";
import { openWorkDetailAtom } from "../../../entities/work/model/navigationActions";
import { useLibraryNavigation, type ReadyLibraryNavigation } from "../model/useLibraryNavigation";
import {
  useLibraryDebouncedSearchQuery,
  useLibrarySupportingQueries,
  useMissingWorksCountQuery,
} from "../model/useLibraryQueries";
import { axisOfGroupBy, buildWorksResetKey } from "../model/libraryPresentation";
import { useLibrarySelectionCleanup } from "../model/useLibrarySelectionCleanup";
import { useLibraryPreviewActions } from "../model/useLibraryPreviewActions";
import AxisValueList from "./AxisValueList";
import BrokenFolderPane from "./BrokenFolderPane";
import FilterChipBand from "./FilterChipBand";
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
  const { view, searchQuery } = nav;
  const debouncedSearchQuery = useLibraryDebouncedSearchQuery(searchQuery);
  const setAppMode = useSetAtom(setAppModeAtom);
  const openWorkDetail = useSetAtom(openWorkDetailAtom);
  const viewMode = useAtomValue(libraryViewModeAtom);

  const {
    facetItems,
    isFacetLoading,
    isFacetError,
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

  const isErrorView = view.kind === "works" && isHasErrorOnly(view.condition);
  const missingWorksCountQuery = useMissingWorksCountQuery(isErrorView);

  const showGrid = viewMode === "grid";

  useLibrarySelectionCleanup({
    nav,
    isNoResultsDueToFilter,
    workDetailError: workDetailQuery.error,
  });

  const previewActions = useLibraryPreviewActions({
    selectedWork,
    openWorkDetail,
    setAppMode,
  });

  return (
    <>
      <div className="mll-resultspane">
        {view.kind !== "broken" && (
          // チップ列は結果面の常設ヘッダーとして .mll-results の外に置く。
          // .mll-results 内側の作品プレビューは絶対配置でスライドインするため、
          // 同じ .mll-results に同居させるとプレビューの下に隠れて操作できなくなる。
          <FilterChipBand
            tagPrefixes={tagPrefixes}
            selectedTags={nav.selectedTags}
            facetScope={
              view.kind === "works"
                ? {
                    folderId: view.folder.id,
                    group: view.group,
                    tags: view.selectedTags,
                    q: debouncedSearchQuery,
                  }
                : undefined
            }
            onAddTag={nav.addTag}
            onRemoveTag={nav.removeTag}
            onClearAll={nav.clearTags}
            worksTotal={view.kind === "works" ? worksTotal : undefined}
            valueListItemCount={view.kind === "value-list" ? facetItems.length : undefined}
          />
        )}
        {view.kind === "broken" ? (
          <BrokenFolderPane folderId={view.folder.id} />
        ) : view.kind === "value-list" ? (
          <div className="mll-results">
            <div className="mll-results__content">
              <AxisValueList
                axis={axisOfGroupBy(view.groupBy)}
                facetItems={facetItems}
                tagPrefixes={tagPrefixes}
                isFacetLoading={isFacetLoading}
                isFacetError={isFacetError}
                isTagPrefixesError={isTagPrefixesError}
                onSelectValue={nav.selectGroupValue}
                onRetryFacets={refetchFacets}
                onRetryTagPrefixes={refetchTagPrefixes}
              />
            </div>
          </div>
        ) : (
          <LibraryWorksBoundary
            nav={nav}
            view={view}
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
                  folderId: view.folder.id,
                  group: view.group,
                  selectedTags: view.selectedTags,
                  sort: view.sort,
                  searchQuery: debouncedSearchQuery,
                  seed: view.seed,
                })}
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
