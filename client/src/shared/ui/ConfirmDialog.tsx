// 破壊的操作の確認ダイアログ。保護タグの削除（ADR-0005: ソフトガード）などに使う。
import { useRef } from "react";
import { useDialogModal } from "./useDialogModal";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({
    onClose: onCancel,
    initialFocusRef: cancelRef,
  });

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event, onCancel)}
      className="m-auto w-[360px] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-[18px_18px_14px] font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex flex-col gap-2.5">
        <span className="font-sans text-[13.5px] font-semibold text-ink-0">{title}</span>
        <p className="m-0 text-[12px] leading-[1.7] text-ink-1">{message}</p>
        <div className="mt-1 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="h-8 cursor-pointer rounded-[6px] border border-line bg-paper-1 px-[14px] font-sans text-[12px] font-medium text-ink-1"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-8 cursor-pointer rounded-[6px] border-none bg-r-coral px-[14px] font-sans text-[12px] font-semibold text-paper-1"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
