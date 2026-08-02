import type { ReactNode } from "react";
import Button from "../../../shared/ui/Button";
import { useDialogModal } from "../../../shared/ui/useDialogModal";

interface NotificationListModalProps<T> {
  titleId: string;
  title: string;
  description: string;
  emptyMessage: string;
  items: T[];
  isLoading: boolean;
  total: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onClose: () => void;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  footer?: ReactNode;
}

export default function NotificationListModal<T>({
  titleId,
  title,
  description,
  emptyMessage,
  items,
  isLoading,
  total,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onClose,
  getItemKey,
  renderItem,
  footer,
}: NotificationListModalProps<T>) {
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose });

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event)}
      className="m-auto w-[min(480px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[min(80vh,calc(100vh-32px))] min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-line-soft px-[18px] py-[14px]">
          <h2 id={titleId} className="font-sans text-[14px] font-semibold">
            {title}
          </h2>
          <p className="mt-1 text-[11.5px] text-ink-2">{description}</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-3">
          {isLoading ? (
            <p className="text-[11.5px] text-ink-3">読み込み中...</p>
          ) : items.length === 0 ? (
            <p className="text-[11.5px] text-ink-3">{emptyMessage}</p>
          ) : (
            <ul className="flex list-none flex-col gap-1 p-0">
              {items.map((item) => (
                <li key={getItemKey(item)}>{renderItem(item)}</li>
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
                : `さらに読み込む（${items.length}/${total}件）`}
            </Button>
          )}
        </div>
        {footer ?? (
          <footer className="flex shrink-0 justify-end border-t border-line-soft px-[18px] py-3">
            <Button variant="quiet" onClick={onClose}>
              閉じる
            </Button>
          </footer>
        )}
      </div>
    </dialog>
  );
}
