import { useRef } from "react";
import type { AxisFacetItem, FacetAxisId, NormalizedTag } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { useAxisFacetsQuery } from "../model/useAxisFacetsQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import type { PopoverLayout } from "./preview/useAnchoredPopover";
import AxisValueQuickList from "./AxisValueQuickList";
import Presence from "../../../shared/ui/Presence";

// チップの兄弟値ドロップダウン・「＋絞り込み」の値ステージが共有する
// 非ポータル版のポップオーバー本体。呼び出し側の `.mll-tagband` / チップは overflow を
// クリップしないため、軸レールのクイックオーバーレイ（AxisQuickOverlay）と違いポータル不要。
// isOpen=false になっても Presence の退出アニメーションが終わるまで呼び出し側は
// マウントを保つ（axis 等の props は最後に開いていた値を保持したまま渡す）。

interface AxisValuePopoverPanelProps {
  axis: AxisId;
  axisLabel: string;
  layout: PopoverLayout;
  isOpen: boolean;
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
  isOpen,
  selectedTags,
  onSelect,
  onAdd,
  close,
  hint,
}: AxisValuePopoverPanelProps) {
  const facetQuery = useAxisFacetsQuery(isOpen ? (axis as FacetAxisId) : null, selectedTags);

  // isOpen=false になった直後にクエリを無効化するため facetQuery.data は失われる。
  // Presence の退出アニメーション中も一覧の中身が消えないよう、開いていた間の最後の
  // 結果を保持し、退出中はそれを表示し続ける（AxisColumn の直前値保持と同じ考え方）。
  const lastResultRef = useRef<{
    items: AxisFacetItem[];
    isLoading: boolean;
    isError: boolean;
  }>({ items: [], isLoading: false, isError: false });
  if (isOpen) {
    lastResultRef.current = {
      items: facetQuery.data ?? [],
      isLoading: facetQuery.isLoading,
      isError: facetQuery.isError,
    };
  }
  const displayResult = isOpen
    ? { items: facetQuery.data ?? [], isLoading: facetQuery.isLoading, isError: facetQuery.isError }
    : lastResultRef.current;

  return (
    <Presence
      show={isOpen}
      variant="popover-scale"
      className="mll-qoverlay mll-qoverlay--inline"
      style={{ left: layout.left, width: layout.width }}
    >
      <AxisValueQuickList
        axis={axis}
        axisLabel={axisLabel}
        isOpen={isOpen}
        items={displayResult.items}
        isLoading={displayResult.isLoading}
        isError={displayResult.isError}
        isSelected={(value) => selectedTags.includes(buildFilterTag(axis, value))}
        onSelect={(item, e) =>
          onSelect(buildFilterTag(axis, item.value), { ctrlKey: e.ctrlKey, metaKey: e.metaKey })
        }
        onAdd={onAdd ? (item) => onAdd(buildFilterTag(axis, item.value)) : undefined}
        close={close}
        hint={hint}
      />
    </Presence>
  );
}
