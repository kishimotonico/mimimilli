import { useLayoutEffect, useState } from "react";

/** 監視する要素の border box の幅。要素が無い間は null。 */
export function useElementWidth(element: HTMLElement | null): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!element) return;
    const update = () => setWidth(element.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element, { box: "border-box" });
    return () => observer.disconnect();
  }, [element]);

  return element ? width : null;
}
