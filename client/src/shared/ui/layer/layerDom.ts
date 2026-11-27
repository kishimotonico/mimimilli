import type { RefObject } from "react";

export const POPOVER_CONTENT_SELECTOR = '[data-scope="popover"][data-part="content"]';
export const MENU_CONTENT_SELECTOR = '[data-scope="menu"][data-part="content"]';
export const MENU_TRIGGER_SELECTOR = '[data-scope="menu"][data-part="trigger"]';

/** メニュー・ポップオーバーの中身（開いている・退出中を問わない） */
export const LAYER_CONTENT_SELECTOR = `${MENU_CONTENT_SELECTOR}, ${POPOVER_CONTENT_SELECTOR}`;

export const OPEN_LAYER_SELECTOR = `${MENU_CONTENT_SELECTOR}:not([inert]), ${POPOVER_CONTENT_SELECTOR}:not([inert])`;

/** メニューの中身（ポータルされた先を含む）の中の要素か */
export function isInsideMenuContent(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(MENU_CONTENT_SELECTOR) !== null;
}

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
