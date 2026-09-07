import type { Virtualizer } from "@tanstack/react-virtual";

/** 仮想化された一覧で、行を画面内へスクロールしてから対象要素へフォーカスする。
 *  scrollToIndex直後は対象がまだDOMに無いことがあるため、見つかるまで
 *  requestAnimationFrameでリトライする。 */
export function focusVirtualItem(
  container: HTMLElement,
  virtualizer: Pick<Virtualizer<HTMLDivElement, Element>, "scrollToIndex">,
  rowIndex: number,
  focusSelector: string,
) {
  virtualizer.scrollToIndex(rowIndex, { align: "auto" });

  let attempts = 0;
  const tryFocus = () => {
    if (attempts++ > 20) return;
    const el = container.querySelector<HTMLElement>(focusSelector);
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else {
      requestAnimationFrame(tryFocus);
    }
  };
  requestAnimationFrame(tryFocus);
}
