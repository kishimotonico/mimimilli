import type { UseMenuProps } from "@ark-ui/react/menu";

type Positioning = NonNullable<UseMenuProps["positioning"]>;

/** トリガーと層の間隔（px）。メニュー・ポップオーバー共通 */
export const LAYER_GUTTER = 6;

/** fixed はダイアログの overflow に切り取られない */
export function layerPositioning(positioning?: Positioning): Positioning {
  return { strategy: "fixed", gutter: LAYER_GUTTER, ...positioning };
}
