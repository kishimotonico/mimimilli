import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Presence from "./Presence";
import { I } from "./Icon";
import IconButton from "./IconButton";
import Button from "./Button";

interface ToastProps {
  /** null/undefined で非表示。表示中に別のメッセージに差し替わっても違和感が出ないよう呼び出し側で管理する */
  message: string | null | undefined;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

function syncPopoverVisibility(el: HTMLElement, visible: boolean) {
  if (!("showPopover" in el)) return;
  try {
    if (visible) el.showPopover();
    else el.hidePopover();
  } catch {
    // 既に同じ状態のとき hidePopover / showPopover は DOMException になる
  }
}

// 単一トーストの表示専用スロット。複数同時表示のキューは今のところ不要なため持たない。
// showModal() の dialog より前面に出すため popover=manual で top layer に載せる（design-system.md）。
export default function Toast({ message, actionLabel, onAction, onDismiss }: ToastProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const visible = Boolean(message);

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    syncPopoverVisibility(el, visible);
  }, [visible]);

  return createPortal(
    <div
      ref={popoverRef}
      popover="manual"
      className="pointer-events-none fixed inset-x-0 top-[58px] m-0 flex justify-center border-none bg-transparent p-0"
    >
      <Presence show={visible} as="output" variant="fade-slide-up">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2 border border-line-soft bg-paper-1 px-3 py-2 shadow-pop">
          <span className="font-jp text-[12px] text-ink-1">{message}</span>
          {actionLabel && onAction && (
            <Button variant="ghost" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          <IconButton icon={I.x} label="閉じる" size="sm" onClick={onDismiss} />
        </div>
      </Presence>
    </div>,
    document.body,
  );
}
