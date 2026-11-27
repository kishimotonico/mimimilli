import type { RefObject } from "react";

export const POPOVER_CONTENT_SELECTOR = '[data-scope="popover"][data-part="content"]';
export const MENU_CONTENT_SELECTOR = '[data-scope="menu"][data-part="content"]';
export const MENU_TRIGGER_SELECTOR = '[data-scope="menu"][data-part="trigger"]';

export const OPEN_LAYER_SELECTOR = `${MENU_CONTENT_SELECTOR}:not([inert]), ${POPOVER_CONTENT_SELECTOR}:not([inert])`;

/** content の id から、その層を開くトリガー（aria-controls）を探す */
export function findLayerTrigger(contentId: string): Element | null {
  return document.querySelector(`[aria-controls="${CSS.escape(contentId)}"]`);
}

/** 所属するポップオーバーまたは native dialog の内側へポータルする */
export function layerContainer(anchor: Element | null): HTMLElement | null {
  return anchor?.closest<HTMLElement>(`dialog, ${POPOVER_CONTENT_SELECTOR}`) ?? null;
}

const popoverReturnTargets = new WeakMap<HTMLElement, RefObject<HTMLElement | null>>();

/** ポップオーバーの content ごとに、閉じたときにフォーカスを戻す先（開く前の要素）を結び付ける */
export function registerPopoverReturnTarget(
  content: HTMLElement,
  target: RefObject<HTMLElement | null>,
) {
  popoverReturnTargets.set(content, target);
}

export function popoverReturnTargetOf(
  content: HTMLElement | null,
): RefObject<HTMLElement | null> | undefined {
  return content ? popoverReturnTargets.get(content) : undefined;
}
