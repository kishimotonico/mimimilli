import { normalizeSearchQuery } from "@mimimilli/shared";
import { hasChipOrSearchRefinement } from "../../../entities/library/refinement";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { buildEmptyWorksHint, buildEmptyWorksMessage } from "../model/emptyWorks";
import RefinementActions from "./RefinementActions";
import type { WorkResultsProps } from "./workResultsProps";

interface Props {
  variant: "list" | "grid";
  nav: WorkResultsProps["nav"];
  searchQuery: string;
  onClearSearch: () => void;
}

/** 作品一覧が0件のときの案内。絞り込み（チップ・検索語）があれば「すべて」で探す入口を出す */
export default function WorksEmptyState({ variant, nav, searchQuery, onClearSearch }: Props) {
  const { view } = nav;
  const hasSelectedTags = view.selectedTags.length > 0;
  const query = normalizeSearchQuery(searchQuery);
  const isFiltered = hasChipOrSearchRefinement({ selectedTags: view.selectedTags, q: searchQuery });
  return (
    <CollectionStatus
      variant={variant}
      kind="empty"
      message={buildEmptyWorksMessage(query, hasSelectedTags)}
      hint={buildEmptyWorksHint(view.folder.condition, isFiltered)}
      action={
        isFiltered ? (
          <RefinementActions
            folderId={view.folder.id}
            hasQuery={query !== ""}
            hasSelectedTags={hasSelectedTags}
            onSearchInAll={nav.searchInAll}
            onClearSearch={onClearSearch}
            onClearTags={nav.clearTags}
          />
        ) : undefined
      }
    />
  );
}
