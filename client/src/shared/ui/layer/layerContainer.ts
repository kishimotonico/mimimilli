const POPOVER_CONTENT_SELECTOR = '[data-scope="popover"][data-part="content"]';

export const OPEN_LAYER_SELECTOR = `[role="menu"]:not([inert]), ${POPOVER_CONTENT_SELECTOR}:not([inert])`;

/** 所属するポップオーバーまたは native dialog の内側へポータルする */
export function layerContainer(anchor: Element | null): HTMLElement | null {
  return anchor?.closest<HTMLElement>(`dialog, ${POPOVER_CONTENT_SELECTOR}`) ?? null;
}
