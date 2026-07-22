// RJコード未検出（フォルダー名からDLsite作品を特定できなかった）作品の一覧。
// スキャン完了ポップアップの「確認する」、ヘッダーの通知ベルの両方から開ける（TASK-41）。
// 各行から作品詳細へ遷移し、警告の「連携設定を編集」から編集ダイアログのRJコード入力に進める。
import Button from "../../../shared/ui/Button";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { useRjCodeMissingWorks } from "../model/dlsiteMissingRjCode";

interface RjCodeMissingModalProps {
  onClose: () => void;
  onOpenWork: (workId: string) => void;
}

export default function RjCodeMissingModal({ onClose, onOpenWork }: RjCodeMissingModalProps) {
  const { works, isLoading, total, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useRjCodeMissingWorks();
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose });

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      aria-labelledby="rj-missing-title"
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event, onClose)}
      className="m-auto w-[min(480px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[min(80vh,calc(100vh-32px))] min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-line-soft px-[18px] py-[14px]">
          <h2 id="rj-missing-title" className="font-sans text-[14px] font-semibold">
            RJコード未検出の作品
          </h2>
          <p className="mt-1 text-[11.5px] text-ink-2">
            フォルダー名からDLsiteのRJコードを自動検出できませんでした。作品を開いてRJコードを入力するか、連携しない設定にできます。
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-3">
          {isLoading ? (
            <p className="text-[11.5px] text-ink-3">読み込み中...</p>
          ) : works.length === 0 ? (
            <p className="text-[11.5px] text-ink-3">RJコード未検出の作品はありません。</p>
          ) : (
            <ul className="flex list-none flex-col gap-1 p-0">
              {works.map((work) => (
                <li key={work.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 py-2 text-left hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
                    onClick={() => onOpenWork(work.id)}
                  >
                    <span className="w-full truncate text-[12px]">{work.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hasNextPage && (
            <Button
              className="mt-3 w-full"
              variant="quiet"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage
                ? "読み込み中..."
                : `さらに読み込む（${works.length}/${total}件）`}
            </Button>
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
