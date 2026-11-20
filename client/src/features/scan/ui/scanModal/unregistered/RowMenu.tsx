import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MENU_PANEL_CLASS, MenuItem } from "../../../../../shared/ui/Menu";
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
            className={MENU_PANEL_CLASS}
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
