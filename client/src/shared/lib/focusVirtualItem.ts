import type { Virtualizer } from "@tanstack/react-virtual";

function focusElement(container: HTMLElement, focusSelector: string) {
  const el = container.querySelector<HTMLElement>(focusSelector);
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** 一覧で、対象行を画面内へスクロールしてから対象要素へフォーカスする。
 *  virtualizerがあれば仮想化された一覧として scrollToIndex 後にフォーカスする
 *  （scrollToIndex直後は対象がまだDOMに無いことがあるため、見つかるまで
 *  requestAnimationFrameでリトライする）。virtualizerが無ければ非仮想化の一覧
 *  として、対象は常にDOMに存在するため即時フォーカスする。 */
export function focusVirtualItem(
  container: HTMLElement,
  virtualizer: Pick<Virtualizer<HTMLDivElement, Element>, "scrollToIndex"> | null,
  rowIndex: number,
  focusSelector: string,
) {
  if (!virtualizer) {
    focusElement(container, focusSelector);
    return;
  }

  virtualizer.scrollToIndex(rowIndex, { align: "auto" });

  let attempts = 0;
  const tryFocus = () => {
    if (attempts++ > 20) return;
    if (container.querySelector<HTMLElement>(focusSelector)) {
      focusElement(container, focusSelector);
    } else {
      requestAnimationFrame(tryFocus);
    }
  };
  requestAnimationFrame(tryFocus);
}
