import { useCallback, useId, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./Button";
import { I } from "./Icon";
import { MENU_PANEL_CLASS, MenuItem } from "./Menu";
import { useAnchoredPopover, type PopoverPlacement } from "./useAnchoredPopover";

export interface SplitButtonItem {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** 破壊的な操作。赤で出す */
  danger?: boolean;
  /** 右端に添える件数などの補足。名前には含めない */
  trailing?: ReactNode;
}

interface SplitButtonProps {
  children: ReactNode;
  onClick: () => void;
  items: SplitButtonItem[];
  disabled?: boolean;
  /** 主ボタンだけを無効にする。▾のメニューは使える */
  primaryDisabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  menuLabel?: string;
  /** メニューの開く向き。既定は上（下端に置く前提） */
  placement?: Extract<PopoverPlacement, "above" | "below">;
  className?: string;
}

/** 主ボタンと▾のメニューを並べた分割ボタン。メニューはEscapeで自分だけを閉じる。 */
export default function SplitButton({
  children,
  onClick,
  items,
  disabled = false,
  primaryDisabled = false,
  variant = "primary",
  size = "sm",
  menuLabel = "その他の操作",
  placement = "above",
  className,
}: SplitButtonProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  const { setReference, setFloating, floatingStyles } = useAnchoredPopover({
    isOpen: open,
    preferredWidth: 0,
    placement,
    onClose: close,
    consumeEscape: true,
  });

  return (
    <div ref={setReference} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        disabled={disabled || primaryDisabled}
        onClick={onClick}
        className={buttonClass(variant, size, {
          disabled: disabled || primaryDisabled,
          className: "flex-1 justify-center rounded-r-none pr-3",
        })}
      >
        {children}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={buttonClass(variant, size, {
          disabled,
          className: "ml-px rounded-l-none pr-[9px] pl-[7px]",
        })}
      >
        <I.chevD size={14} />
      </button>
      {open && (
        <div
          id={menuId}
          ref={setFloating}
          style={floatingStyles}
          role="menu"
          className={MENU_PANEL_CLASS}
        >
          {items.map((item) => (
            <MenuItem
              key={item.key}
              disabled={item.disabled}
              danger={item.danger}
              trailing={item.trailing}
              onSelect={() => {
                close();
                item.onSelect();
              }}
            >
              {item.label}
            </MenuItem>
          ))}
        </div>
      )}
    </div>
  );
}
