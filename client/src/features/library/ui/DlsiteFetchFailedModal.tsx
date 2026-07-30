// DLsite取得に失敗した（work.dlsite.status が "error" または "not_found"）作品の一覧。
// RjCodeMissingModal と同じ流儀（useDialogModal 基盤）で、通知ベルから開く（TASK-44）。
// 各行から作品詳細へ遷移し、DlsitePanelで再取得やRJコードの見直しに進める。
import type { DlsiteStatus } from "@mimimilli/shared";
import { useDlsiteFetchFailedWorks } from "../model/dlsiteFetchFailed";
import NotificationListModal from "./NotificationListModal";

interface DlsiteFetchFailedModalProps {
  onClose: () => void;
  onOpenWork: (workId: string) => void;
}

const STATUS_LABEL: Partial<Record<DlsiteStatus, string>> = {
  not_found: "見つかりません",
  error: "取得エラー",
};

export default function DlsiteFetchFailedModal({
  onClose,
  onOpenWork,
}: DlsiteFetchFailedModalProps) {
  const { works, isLoading, total, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useDlsiteFetchFailedWorks();

  return (
    <NotificationListModal
      titleId="dlsite-fetch-failed-title"
      title="DLsite取得に失敗した作品"
      description="DLsiteへの接続に失敗したか、作品が見つかりませんでした。作品を開いてRJコードを確認するか、時間をおいて再取得を試してください。"
      emptyMessage="DLsite取得に失敗した作品はありません。"
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
          className="flex w-full items-start justify-between gap-2 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 py-2 text-left hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
          onClick={() => onOpenWork(work.id)}
        >
          <span className="min-w-0 flex-1">
            <span className="block w-full truncate text-[12px]">{work.title}</span>
          </span>
          <span className="mt-0.5 shrink-0 rounded-pill bg-[color-mix(in_oklch,var(--r-coral)_12%,transparent)] px-2 py-0.5 font-sans text-[10px] text-[var(--r-coral)]">
            {STATUS_LABEL[work.status] ?? "取得失敗"}
          </span>
        </button>
      )}
    />
  );
}
