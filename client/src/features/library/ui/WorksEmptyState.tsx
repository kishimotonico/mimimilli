import { ALL_SMART_FOLDER_ID } from "@mimimilli/shared";
import Button from "../../../shared/ui/Button";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { I } from "../../../shared/ui/Icon";
import { buildEmptyWorksHint, buildEmptyWorksMessage } from "../model/emptyWorks";
import type { WorkResultsProps } from "./workResultsProps";

interface Props {
  variant: "list" | "grid";
  nav: WorkResultsProps["nav"];
  searchQuery: string;
  onClearSearch: () => void;
}

/** 作品一覧が0件のときの案内。絞り込み（チップ・検索語）があれば「すべて」で探す入口を出す */
export default function WorksEmptyState({ variant, nav, searchQuery, onClearSearch }: Props) {
  const { view, selectedTags } = nav;
  const hasSelectedTags = selectedTags.length > 0;
  const isFiltered = Boolean(searchQuery) || hasSelectedTags;
  const canSearchInAll = isFiltered && view.folder.id !== ALL_SMART_FOLDER_ID;
  return (
    <CollectionStatus
      variant={variant}
      kind="empty"
      message={buildEmptyWorksMessage(searchQuery, hasSelectedTags)}
      hint={buildEmptyWorksHint(view.folder.condition, isFiltered)}
      action={
        isFiltered ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {canSearchInAll && (
              <Button variant="primary" icon={I.search} onClick={nav.searchInAll}>
                「すべて」で探す
              </Button>
            )}
            {searchQuery && (
              <Button variant="ghost" icon={I.x} onClick={onClearSearch}>
                検索をクリア
              </Button>
            )}
            {hasSelectedTags && (
              <Button variant="ghost" icon={I.x} onClick={nav.clearTags}>
                絞り込みをすべてクリア
              </Button>
            )}
          </div>
        ) : undefined
      }
    />
  );
}
