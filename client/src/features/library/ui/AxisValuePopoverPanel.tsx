import { motion, useIsPresent } from "motion/react";
import type { CSSProperties } from "react";
import type { FacetAxisId, NormalizedTag } from "@mimimilli/shared";
import type { AxisId } from "../../../entities/library/types";
import { useAxisFacetsQuery } from "../model/useAxisFacetsQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import AxisValueQuickList from "./AxisValueQuickList";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import type { AnchoredPopoverFloatingRefCallback } from "../../../shared/ui/useAnchoredPopover";

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
  floatingStyles: CSSProperties;
  setFloating: AnchoredPopoverFloatingRefCallback;
  /** 選択中判定（チェック表示）に使う実際の選択タグ */
  selectedTags: NormalizedTag[];
  /** 件数集計に使うタグ。既定=置き換えの呼び出し元（FilterChipBandの兄弟値ドロップダウン）は
   *  空配列、既定=AND追加の呼び出し元（FilterChipAddButton）は selectedTags を渡す
   *  （件数基準はvalueSelectionContract.tsのderiveFacetCountTagsで導出する） */
  countTags: NormalizedTag[];
  /** 表示中のスマートフォルダーID。指定時は候補件数の集計元をフォルダー条件適用後の
   *  集合に絞る */
  smartFolderId?: string;
  onSelect: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  /** ホバー/フォーカス時の＋ボタン（冪等なAND追加）。省略時はボタンを出さない（ADR-0013） */
  onAdd?: (tag: NormalizedTag) => void;
  close: () => void;
  hint?: string;
}

export default function AxisValuePopoverPanel({
  axis,
  axisLabel,
  floatingStyles,
  setFloating,
  selectedTags,
  countTags,
  smartFolderId,
  onSelect,
  onAdd,
  close,
  hint,
}: AxisValuePopoverPanelProps) {
  const isPresent = useIsPresent();
  const facetQuery = useAxisFacetsQuery(axis as FacetAxisId, countTags, smartFolderId);
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
        onAdd={onAdd ? (item) => onAdd(buildFilterTag(axis, item.value)) : undefined}
        close={close}
        hint={hint}
      />
    </motion.div>
  );
}
