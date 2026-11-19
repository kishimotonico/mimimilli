import { useCallback, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./Button";
import { I } from "./Icon";
import { useAnchoredPopover, type PopoverPlacement } from "./useAnchoredPopover";

export interface SplitButtonItem {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

interface SplitButtonProps {
  children: ReactNode;
  onClick: () => void;
  items: SplitButtonItem[];
  disabled?: boolean;
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
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Escapeをメニューだけで受けるためのキー捕捉
    <div
      ref={setReference}
      className={cn("relative inline-flex", className)}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={buttonClass(variant, size, {
          disabled,
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
          className: "rounded-l-none border-l border-paper-1/30 px-2",
        })}
      >
        <I.chevD size={12} />
      </button>
      {open && (
        <div
          id={menuId}
          ref={setFloating}
          style={floatingStyles}
          role="menu"
          className="z-10 min-w-[160px] rounded-[8px] border border-line-soft bg-paper-1 p-1 shadow-pop"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                close();
                item.onSelect();
              }}
              className="flex w-full items-center rounded-[6px] px-2.5 py-1.5 text-left font-jp text-body text-ink-1 hover:bg-paper-2 hover:text-ink-0 disabled:cursor-not-allowed disabled:text-ink-4"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
