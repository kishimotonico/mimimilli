import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";

// スマートフォルダーの0件時に空状態へ差し込むアクション。「条件を編集」は常時、
// 「絞り込みをすべてクリア」はチップ絞り込み中だけ表示する。
export const SMART_FOLDER_EMPTY_MESSAGE = "条件に一致する作品がありません";
export const SMART_FOLDER_EMPTY_HINT = "条件を見直すか、絞り込みを外してください。";

export default function SmartFolderEmptyAction({
  hasSelectedTags,
  onEditRules,
  onClearFilters,
}: {
  hasSelectedTags: boolean;
  onEditRules: () => void;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button variant="primary" icon={I.cog} onClick={onEditRules}>
        条件を編集
      </Button>
      {hasSelectedTags && (
        <Button variant="ghost" icon={I.x} onClick={onClearFilters}>
          絞り込みをすべてクリア
        </Button>
      )}
    </div>
  );
}
