import { createPortal } from "react-dom";
import type { DlsiteApplyMissingPreviewItem } from "@mimimilli/shared";
import Button from "../../../shared/ui/Button";
import Modal, { ModalFooter, ModalHeader } from "../../../shared/ui/Modal";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { formatDlsiteApplyMissingPreviewItem } from "../model/formatDlsiteApplyMissingPreviewItem";

interface DlsiteBulkApplyDialogProps {
  items: DlsiteApplyMissingPreviewItem[];
  selectedWorkIds: ReadonlySet<string>;
  busy: boolean;
  onToggleWorkId: (workId: string, checked: boolean) => void;
  onApply: () => void;
  onClose: () => void;
}

export default function DlsiteBulkApplyDialog({
  items,
  selectedWorkIds,
  busy,
  onToggleWorkId,
  onApply,
  onClose,
}: DlsiteBulkApplyDialogProps) {
  const close = () => {
    if (!busy) onClose();
  };
  const dialog = useDialogModal({ onClose: close });

  return createPortal(
    <Modal
      dialog={dialog}
      size={560}
      labelledBy="dlsite-bulk-apply-title"
      canBackdropClose={() => !busy}
    >
      <ModalHeader
        title={`未設定項目をまとめて適用（対象 ${items.length}件）`}
        titleId="dlsite-bulk-apply-title"
        onClose={close}
        closeDisabled={busy}
      />
      <div className="mll-selectable min-h-0 flex-1 overflow-y-auto px-[18px] py-3 text-body leading-relaxed text-ink-1">
        <p className="pb-2 text-ink-2">
          すでに値が入っている項目は対象に含めていません。適用する作品を選んでください。
        </p>
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.workId}>
              <label className="flex items-start gap-2 rounded-[6px] border-b border-line-soft py-2">
                <input
                  type="checkbox"
                  aria-label={item.title}
                  className="mt-0.5"
                  checked={selectedWorkIds.has(item.workId)}
                  onChange={(event) => onToggleWorkId(item.workId, event.target.checked)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words">{item.title}</span>
                  <span className="block text-ink-2">
                    {formatDlsiteApplyMissingPreviewItem(item)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <ModalFooter>
        <Button variant="quiet" disabled={busy} onClick={close}>
          キャンセル
        </Button>
        <Button variant="primary" disabled={busy || selectedWorkIds.size === 0} onClick={onApply}>
          {busy ? "適用中..." : `選択した${selectedWorkIds.size}件に適用`}
        </Button>
      </ModalFooter>
    </Modal>,
    document.body,
  );
}
