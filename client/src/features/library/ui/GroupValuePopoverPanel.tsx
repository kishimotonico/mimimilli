import { motion, useIsPresent } from "motion/react";
import type { CSSProperties } from "react";
import type { GroupBy, GroupValueItem } from "@mimimilli/shared";
import { useGroupValuesQuery, type GroupValueScope } from "../model/useGroupValuesQuery";
import GroupValueQuickList from "./GroupValueQuickList";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import type { AnchoredPopoverFloatingRefCallback } from "../../../shared/ui/useAnchoredPopover";
import type { HoverGroupPanelHandlers } from "../../../shared/lib/useHoverGroupCoordinator";

// グループの値の一覧を出すポップオーバー本体（値の取得・開閉アニメーション・一覧）。
// 位置決めは呼び出し側が持つ。サイドバーのクイックオーバーレイとパンくずの兄弟値は
// GroupValuePopover がポータルへ出し、「＋絞り込み」は自分の位置決めをそのまま渡す。
//
// 呼び出し側は `<AnimatePresence>` の直下で条件レンダーする。退出アニメーション中は
// AnimatePresence が最後の props を凍結して渡し続けるため、groupBy 等の値を呼び出し側で
// 手動退避する必要はない。

/** right: サイドバーの行から右へ（画面に固定）。below: アンカーの下へ（親の中の絶対配置） */
export const GROUP_VALUE_PLACEMENTS = {
  right: { width: 280, position: "fixed", origin: "left center" },
  below: { width: 240, position: "inline", origin: "top left" },
} as const;

interface GroupValuePopoverPanelProps {
  groupBy: GroupBy;
  groupByLabel: string;
  /** 候補を数える母集団 */
  scope: GroupValueScope;
  placement: keyof typeof GROUP_VALUE_PLACEMENTS;
  setFloating: AnchoredPopoverFloatingRefCallback;
  floatingStyles: CSSProperties;
  panelHandlers?: HoverGroupPanelHandlers;
  isSelected: (value: string) => boolean;
  onSelect: (item: GroupValueItem, event: { ctrlKey: boolean; metaKey: boolean }) => void;
  /** 行の＋ボタン。渡したときだけ出る */
  onAdd?: (item: GroupValueItem) => void;
  close: () => void;
}

export default function GroupValuePopoverPanel({
  groupBy,
  groupByLabel,
  scope,
  placement,
  setFloating,
  floatingStyles,
  panelHandlers,
  isSelected,
  onSelect,
  onAdd,
  close,
}: GroupValuePopoverPanelProps) {
  const isPresent = useIsPresent();
  const groupValuesQuery = useGroupValuesQuery(groupBy, scope);
  const { popoverScale } = useMotionVariants();
  const { position, origin } = GROUP_VALUE_PLACEMENTS[placement];
  const variant = popoverScale({ origin });

  return (
    <motion.div
      ref={setFloating}
      {...variant}
      className={`mll-qoverlay mll-qoverlay--${position}`}
      style={floatingStyles}
      inert={!isPresent}
      {...panelHandlers}
    >
      <GroupValueQuickList
        groupBy={groupBy}
        groupByLabel={groupByLabel}
        isOpen={isPresent}
        items={groupValuesQuery.data ?? []}
        isLoading={groupValuesQuery.isLoading}
        isError={groupValuesQuery.isError}
        isSelected={isSelected}
        onSelect={onSelect}
        onAdd={onAdd}
        close={close}
      />
    </motion.div>
  );
}
