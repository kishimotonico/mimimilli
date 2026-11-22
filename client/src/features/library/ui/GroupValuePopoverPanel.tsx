import { motion, useIsPresent } from "motion/react";
import type { CSSProperties } from "react";
import type { GroupBy, NormalizedTag } from "@mimimilli/shared";
import { useGroupValuesQuery, type GroupValueScope } from "../model/useGroupValuesQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import GroupValueQuickList from "./GroupValueQuickList";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import type { AnchoredPopoverFloatingRefCallback } from "../../../shared/ui/useAnchoredPopover";

// 「＋絞り込み」の値ステージ。非ポータル版のポップオーバー本体。呼び出し側の
// `.mll-tagband` は overflow をクリップしないため、サイドバーのクイックオーバーレイ
// （GroupQuickOverlay）と違いポータル不要。
//
// 呼び出し側（FilterChipAddButton）は `<AnimatePresence>` の直下で
// `{isOpen && <GroupValuePopoverPanel key={groupBy} .../>}` のように条件レンダーする。
// 退出アニメーション中は AnimatePresence が最後の props を凍結して渡し続けるため、
// groupBy 等の値を呼び出し側で手動退避する必要はない。

interface GroupValuePopoverPanelProps {
  groupBy: GroupBy;
  groupByLabel: string;
  floatingStyles: CSSProperties;
  setFloating: AnchoredPopoverFloatingRefCallback;
  /** 選択中判定（チェック表示）に使う実際の選択タグ */
  selectedTags: NormalizedTag[];
  /** 候補を数える母集団（開いている一覧の条件・値・チップ・検索語） */
  scope: GroupValueScope;
  onSelect: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  close: () => void;
}

export default function GroupValuePopoverPanel({
  groupBy,
  groupByLabel,
  floatingStyles,
  setFloating,
  selectedTags,
  scope,
  onSelect,
  close,
}: GroupValuePopoverPanelProps) {
  const isPresent = useIsPresent();
  const groupValuesQuery = useGroupValuesQuery(groupBy, scope);
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
      <GroupValueQuickList
        groupBy={groupBy}
        groupByLabel={groupByLabel}
        isOpen={isPresent}
        items={groupValuesQuery.data ?? []}
        isLoading={groupValuesQuery.isLoading}
        isError={groupValuesQuery.isError}
        isSelected={(value) => selectedTags.includes(buildFilterTag(groupBy, value))}
        onSelect={(item, e) =>
          onSelect(buildFilterTag(groupBy, item.value), { ctrlKey: e.ctrlKey, metaKey: e.metaKey })
        }
        close={close}
      />
    </motion.div>
  );
}
