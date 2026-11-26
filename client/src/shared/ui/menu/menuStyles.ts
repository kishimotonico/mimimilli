import { cn } from "../../lib/cn";
import { panelFrameClass } from "../layer/layerStyles";

export const MENU_GUTTER = 6;

const PANEL_BASE =
  `z-50 grid w-max max-w-[280px] grid-cols-[minmax(0,1fr)] p-1 outline-none ${panelFrameClass}`;

export function menuPanelClass(options: { narrow?: boolean } = {}): string {
  return cn(PANEL_BASE, options.narrow ? "min-w-[112px]" : "min-w-[180px]");
}

const ITEM_BASE =
  "flex h-7 w-full cursor-default items-center gap-2 rounded-1 px-2 text-left font-jp text-body whitespace-nowrap outline-none data-[highlighted]:bg-paper-2 data-[disabled]:text-ink-4";

export function menuItemClass(options: { danger?: boolean } = {}): string {
  return cn(
    ITEM_BASE,
    options.danger
      ? "text-[var(--state-danger)]"
      : "text-ink-1 data-[highlighted]:text-ink-0 data-[disabled]:data-[highlighted]:text-ink-4",
  );
}

export const MENU_LABEL_CLASS = "min-w-0 flex-1 truncate";
export const MENU_COUNT_CLASS = "ml-auto shrink-0 pl-4 font-mono text-mono text-ink-3";
export const MENU_CHECK_COLUMN_CLASS =
  "flex size-[14px] shrink-0 items-center justify-center text-acc";
export const MENU_SEPARATOR_CLASS = "my-1 h-px border-0 bg-line-soft";
export const MENU_HEADING_CLASS =
  "px-2 pt-1.5 pb-0.5 font-sans text-label font-semibold tracking-[0.08em] text-ink-2";
