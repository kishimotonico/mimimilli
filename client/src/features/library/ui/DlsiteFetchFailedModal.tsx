// DLsite取得に失敗した（work.dlsite.status が "error" または "not_found"）作品の一覧。
// RjCodeMissingModal と同じ流儀（useDialogModal 基盤）で、通知ベルから開く（TASK-44）。
// 各行から作品詳細へ遷移し、DlsitePanelで再取得やRJコードの見直しに進める。
import type { DlsiteStatus } from "@mimimilli/shared";
import Button from "../../../shared/ui/Button";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { useDlsiteFetchFailedWorks } from "../model/dlsiteFetchFailed";

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
  const { works, isLoading } = useDlsiteFetchFailedWorks();
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose });

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      aria-labelledby="dlsite-fetch-failed-title"
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event, onClose)}
      className="m-auto w-[min(480px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[min(80vh,calc(100vh-32px))] min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-line-soft px-[18px] py-[14px]">
          <h2 id="dlsite-fetch-failed-title" className="font-sans text-[14px] font-semibold">
            DLsite取得に失敗した作品
          </h2>
          <p className="mt-1 text-[11.5px] text-ink-2">
            RJコードが見つからないか、DLsiteのページ構造が変わった可能性があります。作品を開いてRJコードを確認するか、再取得を試してください。
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-3">
          {isLoading ? (
            <p className="text-[11.5px] text-ink-3">読み込み中...</p>
          ) : works.length === 0 ? (
            <p className="text-[11.5px] text-ink-3">DLsite取得に失敗した作品はありません。</p>
          ) : (
            <ul className="flex list-none flex-col gap-1 p-0">
              {works.map((work) => (
                <li key={work.id}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-2 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 py-2 text-left hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
                    onClick={() => onOpenWork(work.id)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block w-full truncate text-[12px]">{work.title}</span>
                      <span className="block w-full truncate font-mono text-[10px] text-ink-3">
                        {work.physicalPath}
                      </span>
                    </span>
                    <span className="mt-0.5 shrink-0 rounded-pill bg-[color-mix(in_oklch,var(--r-coral)_12%,transparent)] px-2 py-0.5 font-sans text-[10px] text-[var(--r-coral)]">
                      {STATUS_LABEL[work.dlsite.status] ?? "取得失敗"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="flex shrink-0 justify-end border-t border-line-soft px-[18px] py-3">
          <Button variant="quiet" onClick={onClose}>
            閉じる
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
