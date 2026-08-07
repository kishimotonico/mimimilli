import { motion, useIsPresent } from "motion/react";
import type { FacetAxisId, NormalizedTag } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { useAxisFacetsQuery } from "../model/useAxisFacetsQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import type { PopoverLayout } from "./preview/useAnchoredPopover";
import AxisValueQuickList from "./AxisValueQuickList";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";

// チップの兄弟値ドロップダウン・「＋絞り込み」の値ステージが共有する
// 非ポータル版のポップオーバー本体。呼び出し側の `.mll-tagband` / チップは overflow を
// クリップしないため、軸レールのクイックオーバーレイ（AxisQuickOverlay）と違いポータル不要。
//
// 呼び出し側（FilterChipBand / FilterChipAddButton）は `<AnimatePresence>` の直下で
// `{isOpen && <AxisValuePopoverPanel key={axis} .../>}` のように条件レンダーする。
// 退出アニメーション中は AnimatePresence が最後の props を凍結して渡し続けるため、
// axis 等の値を呼び出し側で手動退避する必要はない。

interface AxisValuePopoverPanelProps {
  axis: AxisId;
  axisLabel: string;
  layout: PopoverLayout;
  selectedTags: NormalizedTag[];
  onSelect: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  /** ホバー/フォーカス時の＋ボタン（冪等なAND追加）。省略時はボタンを出さない（ADR-0013） */
  onAdd?: (tag: NormalizedTag) => void;
  close: () => void;
  hint?: string;
}

export default function AxisValuePopoverPanel({
  axis,
  axisLabel,
  layout,
  selectedTags,
  onSelect,
  onAdd,
  close,
  hint,
}: AxisValuePopoverPanelProps) {
  const isPresent = useIsPresent();
  const facetQuery = useAxisFacetsQuery(axis as FacetAxisId, selectedTags);
  const { popoverScale } = useMotionVariants();
  const variant = popoverScale({ origin: "top left" });

  return (
    <motion.div
      initial={variant.initial}
      animate={variant.animate}
      exit={variant.exit}
      className="mll-qoverlay mll-qoverlay--inline"
      style={{ left: layout.left, width: layout.width }}
      inert={!isPresent}
    >
      <AxisValueQuickList
        axis={axis}
        axisLabel={axisLabel}
        isOpen={isPresent}
        items={facetQuery.data ?? []}
        isLoading={facetQuery.isLoading}
        isError={facetQuery.isError}
        isSelected={(value) => selectedTags.includes(buildFilterTag(axis, value))}
        onSelect={(item, e) =>
          onSelect(buildFilterTag(axis, item.value), { ctrlKey: e.ctrlKey, metaKey: e.metaKey })
        }
        onAdd={onAdd ? (item) => onAdd(buildFilterTag(axis, item.value)) : undefined}
        close={close}
        hint={hint}
      />
    </motion.div>
  );
}
