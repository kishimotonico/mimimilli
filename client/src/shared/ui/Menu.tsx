import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/** ポップアップメニューの枠。行の⋮・分割ボタンの▾で共有する。 */
export const MENU_PANEL_CLASS =
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
