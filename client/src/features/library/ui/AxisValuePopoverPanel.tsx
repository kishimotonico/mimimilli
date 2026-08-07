import type { FacetAxisId, NormalizedTag } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { useAxisFacetsQuery } from "../model/useAxisFacetsQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import type { PopoverLayout } from "./preview/useAnchoredPopover";
import AxisValueQuickList from "./AxisValueQuickList";

// チップの兄弟値ドロップダウン・「＋絞り込み」の値ステージが共有する
// 非ポータル版のポップオーバー本体。呼び出し側の `.mll-tagband` / チップは overflow を
// クリップしないため、軸レールのクイックオーバーレイ（AxisQuickOverlay）と違いポータル不要。

interface AxisValuePopoverPanelProps {
  axis: AxisId;
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
  layout,
  selectedTags,
  onSelect,
  onAdd,
  close,
  hint,
}: AxisValuePopoverPanelProps) {
  const facetQuery = useAxisFacetsQuery(axis as FacetAxisId, selectedTags);

  return (
    <div
      className="mll-qoverlay mll-qoverlay--inline"
      style={{ left: layout.left, width: layout.width }}
    >
      <AxisValueQuickList
        axis={axis}
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
    </div>
  );
}
