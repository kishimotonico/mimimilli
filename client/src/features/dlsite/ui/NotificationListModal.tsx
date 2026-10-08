import type { ReactNode } from "react";
import Button from "../../../shared/ui/Button";
import Modal, { ModalFooter, ModalHeader } from "../../../shared/ui/Modal";
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
  const dialog = useDialogModal({ onClose });

  return (
    <Modal dialog={dialog} size={480} height="short" labelledBy={titleId}>
      <ModalHeader
        title={title}
        titleId={titleId}
        description={<p className="mt-1 text-secondary text-ink-2">{description}</p>}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-3">
        {isLoading ? (
          <p className="text-secondary text-ink-2">読み込み中...</p>
        ) : items.length === 0 ? (
          <p className="text-secondary text-ink-2">{emptyMessage}</p>
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
            {isFetchingNextPage ? "読み込み中..." : `さらに読み込む（${items.length}/${total}件）`}
          </Button>
        )}
      </div>
      {footer ?? (
        <ModalFooter>
          <Button variant="quiet" onClick={onClose}>
            閉じる
          </Button>
        </ModalFooter>
      )}
    </Modal>
  );
}
