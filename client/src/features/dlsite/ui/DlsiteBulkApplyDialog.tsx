import { createPortal } from "react-dom";
import Button from "../../../shared/ui/Button";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import { useDialogModal } from "../../../shared/ui/useDialogModal";

interface DlsiteBulkApplyDialogProps {
  busy: boolean;
  onApply: () => void;
  onClose: () => void;
}

export default function DlsiteBulkApplyDialog({
  busy,
  onApply,
  onClose,
}: DlsiteBulkApplyDialogProps) {
  const close = () => {
    if (!busy) onClose();
  };
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose: close });

  return createPortal(
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      aria-labelledby="dlsite-bulk-apply-title"
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event, () => !busy)}
      className="m-auto w-[min(440px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[calc(100vh-48px)] min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center border-b border-line-soft px-[18px] py-[14px]">
          <h2
            id="dlsite-bulk-apply-title"
            className="min-w-0 flex-1 font-sans text-[14px] font-semibold"
          >
            未設定項目をまとめて適用
          </h2>
          <IconButton icon={I.x} label="閉じる" size="sm" disabled={busy} onClick={close} />
        </header>
        <div className="mll-selectable min-h-0 flex-1 overflow-y-auto px-[18px] py-3 text-[12px] leading-relaxed text-ink-1">
          <p>
            取得済みのDLsite情報を、ライブラリ内の全作品の未設定項目へ適用します。タイトル・URL・カバー・タグなど、すでに値が入っている項目は上書きしません。
          </p>
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-line-soft px-[18px] py-3">
          <Button variant="quiet" disabled={busy} onClick={close}>
            キャンセル
          </Button>
          <Button variant="primary" disabled={busy} onClick={onApply}>
            {busy ? "適用中..." : "適用"}
          </Button>
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}
