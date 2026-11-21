import { useCallback, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { useAnchoredPopover, type PopoverPlacement } from "./useAnchoredPopover";

const MENU_PANEL_CLASS =
  "z-10 min-w-[180px] rounded-[8px] border border-line bg-paper-1 p-1 shadow-pop";

interface MenuItemProps {
  onSelect: () => void;
  /** 破壊的な操作。赤で出す */
  danger?: boolean;
  disabled?: boolean;
  /** 右端に添える件数などの補足。名前には含めない */
  trailing?: ReactNode;
  children: ReactNode;
}

export function MenuItem({
  onSelect,
  danger = false,
  disabled = false,
  trailing,
  children,
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-[5px] px-2.5 py-1.5 text-left font-jp text-body whitespace-nowrap hover:bg-paper-2 disabled:cursor-not-allowed disabled:text-ink-4",
        danger ? "text-[var(--state-danger)]" : "text-ink-0",
      )}
    >
      {children}
      {trailing !== undefined && (
        <span aria-hidden="true" className="font-mono text-secondary text-ink-2">
          {trailing}
        </span>
      )}
    </button>
  );
}

export interface MenuItemSpec {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** 破壊的な操作。赤で出す */
  danger?: boolean;
  /** 右端に添える件数などの補足。名前には含めない */
  trailing?: ReactNode;
}

export interface PopupMenuTriggerProps {
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  onClick: () => void;
}

interface PopupMenuProps {
  items: readonly MenuItemSpec[];
  /** メニューの開く向き。above は上向き、belowEnd は下向きでトリガーの右端にそろえる */
  placement: Extract<PopoverPlacement, "above" | "belowEnd">;
  /** スクロールで閉じる。メニューがアンカーと一緒に動かない場所（スクロールする一覧の中）で使う */
  closeOnScroll?: boolean;
  /** フォーカスがメニューとトリガーの外へ出たら閉じる */
  closeOnFocusOut?: boolean;
  /** トリガーを置く領域に付ける。メニューはこの領域を起点に開く */
  className?: string;
  /** トリガーを描く。渡された props をトグルのボタンへ展開する */
  children: (trigger: PopupMenuTriggerProps) => ReactNode;
}

/**
 * 項目の配列を受けるポップアップメニュー。トリガーは呼び出し側が描く。
 * 開閉・Escape・外側クリックでの閉じ方、項目を選ぶ前に閉じることをここで持つ。
 * 所属するダイアログがあればその中へ出す。
 */
export function PopupMenu({
  items,
  placement,
  closeOnScroll = false,
  closeOnFocusOut = false,
  className,
  children,
}: PopupMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  const { setReference, setFloating, floatingStyles } = useAnchoredPopover({
    isOpen: open,
    preferredWidth: 0,
    placement,
    onClose: close,
    closeOnScroll,
    closeOnFocusOut,
  });
  const attachAnchor = useCallback(
    (node: HTMLElement | null) => {
      setAnchor(node);
      setReference(node);
    },
    [setReference],
  );

  return (
    <div ref={attachAnchor} className={cn("relative inline-flex", className)}>
      {children({
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? menuId : undefined,
        onClick: () => setOpen((value) => !value),
      })}
      {open &&
        createPortal(
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
          </div>,
          anchor?.closest("dialog") ?? document.body,
        )}
    </div>
  );
}
