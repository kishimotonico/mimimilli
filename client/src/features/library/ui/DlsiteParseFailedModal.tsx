import Button from "../../../shared/ui/Button";
import { useDlsiteParseFailedWorks } from "../model/dlsiteParseFailed";
import NotificationListModal from "./NotificationListModal";

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

  return (
    <NotificationListModal
      titleId="dlsite-parse-failed-title"
      title="DLsiteパース失敗の作品"
      description="DLsiteのページ構造が変わった可能性があります。RJコードを控え、キャッシュ済みHTMLを取り出してパーサを直してください。"
      emptyMessage="パース失敗の作品はありません。"
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
          aria-label={`${work.title}（${work.rjCode}）`}
          className="flex w-full items-start justify-between gap-2 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 py-2 text-left hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
          onClick={() => onOpenWork(work.id)}
        >
          <span className="min-w-0 flex-1">
            <span className="block w-full truncate text-[12px]">{work.title}</span>
            <span className="mt-0.5 block font-mono text-[10.5px] text-ink-3">{work.rjCode}</span>
          </span>
        </button>
      )}
      footer={
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
      }
    />
  );
}
