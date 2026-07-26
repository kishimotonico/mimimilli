import Button from "../../../shared/ui/Button";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { useDlsiteParseFailedWorks } from "../model/dlsiteParseFailed";

interface DlsiteParseFailedModalProps {
  onClose: () => void;
  onOpenWork: (workId: string) => void;
}

export default function DlsiteParseFailedModal({
  onClose,
  onOpenWork,
}: DlsiteParseFailedModalProps) {
  const { works, isLoading, total, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useDlsiteParseFailedWorks();
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose });

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      aria-labelledby="dlsite-parse-failed-title"
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event, onClose)}
      className="m-auto w-[min(480px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[min(80vh,calc(100vh-32px))] min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-line-soft px-[18px] py-[14px]">
          <h2 id="dlsite-parse-failed-title" className="font-sans text-[14px] font-semibold">
            DLsiteパース失敗の作品
          </h2>
          <p className="mt-1 text-[11.5px] text-ink-2">
            DLsiteのページ構造が変わった可能性があります。RJコードを控え、キャッシュ済みHTMLを取り出してパーサを直してください。
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-3">
          {isLoading ? (
            <p className="text-[11.5px] text-ink-3">読み込み中...</p>
          ) : works.length === 0 ? (
            <p className="text-[11.5px] text-ink-3">パース失敗の作品はありません。</p>
          ) : (
            <ul className="flex list-none flex-col gap-1 p-0">
              {works.map((work) => (
                <li key={work.id}>
                  <button
                    type="button"
                    aria-label={`${work.title}（${work.rjCode}）`}
                    className="flex w-full items-start justify-between gap-2 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 py-2 text-left hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
                    onClick={() => onOpenWork(work.id)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block w-full truncate text-[12px]">{work.title}</span>
                      <span className="mt-0.5 block font-mono text-[10.5px] text-ink-3">
                        {work.rjCode}
                      </span>
                    </span>
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
        <footer className="flex shrink-0 flex-col gap-2 border-t border-line-soft px-[18px] py-3">
          <p className="font-mono text-[10px] leading-relaxed text-ink-3">
            pnpm --filter @mimimilli/server dlsite-cache -- export --product-code RJ000000 --file
            ./work.html
          </p>
          <div className="flex justify-end">
            <Button variant="quiet" onClick={onClose}>
              閉じる
            </Button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
