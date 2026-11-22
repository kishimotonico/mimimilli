import { motion, useIsPresent } from "motion/react";
import type { CSSProperties } from "react";
import type { NormalizedTag } from "@mimimilli/shared";
import type { AxisId } from "../../../entities/library/types";
import { useAxisFacetsQuery, type FacetScope } from "../model/useAxisFacetsQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import AxisValueQuickList from "./AxisValueQuickList";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import type { AnchoredPopoverFloatingRefCallback } from "../../../shared/ui/useAnchoredPopover";

// 「＋絞り込み」の値ステージ。非ポータル版のポップオーバー本体。呼び出し側の
// `.mll-tagband` は overflow をクリップしないため、軸レールのクイックオーバーレイ
// （AxisQuickOverlay）と違いポータル不要。
//
// 呼び出し側（FilterChipAddButton）は `<AnimatePresence>` の直下で
// `{isOpen && <AxisValuePopoverPanel key={axis} .../>}` のように条件レンダーする。
// 退出アニメーション中は AnimatePresence が最後の props を凍結して渡し続けるため、
// axis 等の値を呼び出し側で手動退避する必要はない。

interface AxisValuePopoverPanelProps {
  axis: AxisId;
  axisLabel: string;
  floatingStyles: CSSProperties;
  setFloating: AnchoredPopoverFloatingRefCallback;
  /** 選択中判定（チェック表示）に使う実際の選択タグ */
  selectedTags: NormalizedTag[];
  /** 候補を数える母集団（開いている一覧の条件・値・チップ・検索語） */
  scope: FacetScope;
  onSelect: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  close: () => void;
}

export default function AxisValuePopoverPanel({
  axis,
  axisLabel,
  floatingStyles,
  setFloating,
  selectedTags,
  scope,
  onSelect,
  close,
}: AxisValuePopoverPanelProps) {
  const isPresent = useIsPresent();
  const facetQuery = useAxisFacetsQuery(axis, scope);
  const { popoverScale } = useMotionVariants();
  const variant = popoverScale({ origin: "top left" });

  return (
    <motion.div
      ref={setFloating}
      className="mll-qoverlay mll-qoverlay--inline"
      style={floatingStyles}
      inert={!isPresent}
      {...variant}
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
        close={close}
      />
    </motion.div>
  );
}
