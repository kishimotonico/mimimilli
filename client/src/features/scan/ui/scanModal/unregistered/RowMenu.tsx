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
  const {
    setReference,
    setFloating,
    floatingStyles,
    close: closePopover,
  } = useAnchoredPopover({
    isOpen: open,
    preferredWidth: 0,
    placement: "above",
    onClose: close,
    closeOnScroll: true,
    closeOnFocusOut: true,
  });

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Escapeをメニューだけで受けるためのキー捕捉
    <div
      ref={(node) => {
        anchorRef.current = node;
        setReference(node);
      }}
      className="relative inline-flex"
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        closePopover("escape");
      }}
    >
      <IconButton
        icon={I.more}
        label={label}
        size="sm"
        disabled={disabled}
        active={open}
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
            className="z-10 min-w-[140px] rounded-[8px] border border-line-soft bg-paper-1 p-1 shadow-pop"
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
      className={`flex w-full items-center rounded-[6px] px-2.5 py-1.5 text-left font-jp text-body hover:bg-paper-2 ${
        danger ? "text-[var(--state-danger)]" : "text-ink-1 hover:text-ink-0"
      }`}
    >
      {children}
    </button>
  );
}
