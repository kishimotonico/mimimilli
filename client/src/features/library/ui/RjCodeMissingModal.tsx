// RJコード未検出（フォルダー名からDLsite作品を特定できなかった）作品の一覧。
// スキャン完了ポップアップの「確認する」、ヘッダーの通知ベルの両方から開ける（TASK-41）。
// 各行から作品詳細へ遷移し、警告の「連携設定を編集」から編集ダイアログのRJコード入力に進める。
import { useRjCodeMissingWorks } from "../model/dlsiteMissingRjCode";
import NotificationListModal from "./NotificationListModal";

interface RjCodeMissingModalProps {
  onClose: () => void;
  onOpenWork: (workId: string) => void;
}

export default function RjCodeMissingModal({ onClose, onOpenWork }: RjCodeMissingModalProps) {
  const { works, isLoading, total, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useRjCodeMissingWorks();

  return (
    <NotificationListModal
      titleId="rj-missing-title"
      title="RJコード未検出の作品"
      description="フォルダー名からDLsiteのRJコードを自動検出できませんでした。作品を開いてRJコードを入力するか、連携しない設定にできます。"
      emptyMessage="RJコード未検出の作品はありません。"
      items={works}
      isLoading={isLoading}
      total={total}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      onClose={onClose}
      getItemKey={(work) => work.id}
      renderItem={(work) => (
        <button
          type="button"
          className="flex w-full flex-col items-start gap-0.5 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 py-2 text-left hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
          onClick={() => onOpenWork(work.id)}
        >
          <span className="w-full truncate text-[12px]">{work.title}</span>
        </button>
      )}
    />
  );
}
