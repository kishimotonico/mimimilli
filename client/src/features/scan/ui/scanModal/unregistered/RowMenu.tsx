import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import IconButton from "../../../../../shared/ui/IconButton";
import { I } from "../../../../../shared/ui/Icon";
import { useAnchoredPopover } from "../../../../../shared/ui/useAnchoredPopover";

interface RowMenuProps {
  label: string;
  disabled: boolean;
  onOpenFolder: () => void;
  onExclude: () => void;
}

/** 行の右端の︙メニュー。Escapeはメニューだけを閉じる。 */
export default function RowMenu({ label, disabled, onOpenFolder, onExclude }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  const anchorRef = useRef<HTMLElement | null>(null);
  const { setReference, setFloating, floatingStyles } = useAnchoredPopover({
    isOpen: open,
    preferredWidth: 0,
    placement: "belowEnd",
    onClose: close,
    closeOnScroll: true,
    closeOnFocusOut: true,
    consumeEscape: true,
  });

  return (
    <div
      ref={(node) => {
        anchorRef.current = node;
        setReference(node);
      }}
      className="relative inline-flex"
    >
      <IconButton
        icon={I.moreV}
        label={label}
        size="sm"
        tone="muted"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      />
      {open &&
        createPortal(
          <div
            id={menuId}
            ref={setFloating}
            style={floatingStyles}
            role="menu"
            className="z-10 min-w-[180px] rounded-[8px] border border-line bg-paper-1 p-1 shadow-pop"
          >
            <MenuItem
              onSelect={() => {
                close();
                onOpenFolder();
              }}
            >
              フォルダーを開く
            </MenuItem>
            <MenuItem
              danger
              onSelect={() => {
                close();
                onExclude();
              }}
            >
              除外
            </MenuItem>
          </div>,
          anchorRef.current?.closest("dialog") ?? document.body,
        )}
    </div>
  );
}

function MenuItem({
  danger = false,
  onSelect,
  children,
}: {
  danger?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`flex w-full items-center rounded-[5px] px-2.5 py-1.5 text-left font-jp text-body whitespace-nowrap hover:bg-paper-2 ${
        danger ? "text-[var(--state-danger)]" : "text-ink-0"
      }`}
    >
      {children}
    </button>
  );
}
