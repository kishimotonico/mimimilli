import { MENU_CONTENT_SELECTOR, POPOVER_CONTENT_SELECTOR, popoverReturnTargetOf } from "./layerDom";

/**
 * フォーカスを戻す先。メニューの中ならトリガー、ポップオーバーの中なら開く前の要素を返す。
 */
export function resolveFocusReturnTarget(active: EventTarget | Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement) || active === active.ownerDocument.body) return null;
  const menu = active.closest(MENU_CONTENT_SELECTOR);
  const triggerId = menu?.getAttribute("aria-labelledby");
  if (triggerId) return active.ownerDocument.getElementById(triggerId);
  const target = popoverReturnTargetOf(active.closest<HTMLElement>(POPOVER_CONTENT_SELECTOR));
  return target ? target.current : active;
}

/** フォーカスがどこにも無い（body）。消えた行・トリガーからのフォーカスの移し替えの前提 */
export function isFocusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body;
}
