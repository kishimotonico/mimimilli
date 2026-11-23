import { ALL_SMART_FOLDER_ID } from "@mimimilli/shared";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";

interface Props {
  folderId: string;
  hasQuery: boolean;
  hasSelectedTags: boolean;
  onSearchInAll: () => void;
  onClearSearch: () => void;
  onClearTags: () => void;
}

/** 絞り込み（チップ・検索語）で0件になった一覧の操作（作品一覧・値一覧で共通） */
export default function RefinementActions({
  folderId,
  hasQuery,
  hasSelectedTags,
  onSearchInAll,
  onClearSearch,
  onClearTags,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {folderId !== ALL_SMART_FOLDER_ID && (
        <Button variant="primary" icon={I.search} onClick={onSearchInAll}>
          「すべて」で探す
        </Button>
      )}
      {hasQuery && (
        <Button variant="ghost" icon={I.x} onClick={onClearSearch}>
          検索をクリア
        </Button>
      )}
      {hasSelectedTags && (
        <Button variant="ghost" icon={I.x} onClick={onClearTags}>
          絞り込みをすべてクリア
        </Button>
      )}
    </div>
  );
}
