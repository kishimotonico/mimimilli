import type { ComponentPropsWithoutRef } from "react";

type BoundaryHandlers = Pick<
  ComponentPropsWithoutRef<"div">,
  "onPointerDown" | "onClick" | "onKeyDown"
>;

/**
 * ポータルした層の中のイベントを、React のツリーの祖先へ伝えない。
 * zag は document のネイティブのリスナーで動くので影響しない。
 */
export function layerEventBoundary({
  onPointerDown,
  onClick,
  onKeyDown,
}: BoundaryHandlers): Required<BoundaryHandlers> {
  return {
    onPointerDown(event) {
      onPointerDown?.(event);
      event.stopPropagation();
    },
    onClick(event) {
      onClick?.(event);
      event.stopPropagation();
    },
    onKeyDown(event) {
      onKeyDown?.(event);
      event.stopPropagation();
    },
  };
}
