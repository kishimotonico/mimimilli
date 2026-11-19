import { flushAllResizeObservers } from "../unit/setup";

const WIDTH = 900;
const HEIGHT = 520;

/** 未登録タブの仮想リストにレイアウトサイズを与える。返す関数で元へ戻す。 */
export function mockUnregisteredListSize(): () => void {
  const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  const rect = HTMLElement.prototype.getBoundingClientRect;
  const isList = (element: HTMLElement) =>
    element.parentElement?.getAttribute("role") === "table" &&
    element.classList.contains("overflow-y-auto");
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return isList(this) ? HEIGHT : (offsetHeight?.get?.call(this) ?? 0);
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return isList(this) ? WIDTH : (offsetWidth?.get?.call(this) ?? 0);
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    return isList(this) ? new DOMRect(0, 0, WIDTH, HEIGHT) : rect.call(this);
  };
  return () => {
    if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
    if (offsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", offsetWidth);
    HTMLElement.prototype.getBoundingClientRect = rect;
  };
}

export function flushUnregisteredListSize(): void {
  flushAllResizeObservers({ width: WIDTH, height: HEIGHT });
}
