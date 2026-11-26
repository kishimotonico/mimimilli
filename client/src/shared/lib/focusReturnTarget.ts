import type { RefObject } from "react";

export const POPOVER_CONTENT_SELECTOR = '[data-scope="popover"][data-part="content"]';

const popoverReturnTargets = new WeakMap<HTMLElement, RefObject<HTMLElement | null>>();

export function registerPopoverReturnTarget(
  content: HTMLElement,
  target: RefObject<HTMLElement | null>,
) {
  popoverReturnTargets.set(content, target);
}

/**
 * フォーカスを戻す先。メニューの中ならトリガー、ポップオーバーの中なら開く前の要素を返す。
 */
export function resolveFocusReturnTarget(active: EventTarget | Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement) || active === active.ownerDocument.body) return null;
  const menu = active.closest('[role="menu"]');
  const triggerId = menu?.getAttribute("aria-labelledby");
  if (triggerId) return active.ownerDocument.getElementById(triggerId);
  const popover = active.closest<HTMLElement>(POPOVER_CONTENT_SELECTOR);
  const target = popover && popoverReturnTargets.get(popover);
  return target ? target.current : active;
}

/** フォーカスがどこにも無い（body）。消えた行・トリガーからのフォーカスの移し替えの前提 */
export function isFocusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body;
}
