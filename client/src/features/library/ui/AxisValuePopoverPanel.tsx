import type { FacetAxisId } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { useAxisFacetsQuery } from "../model/useAxisFacetsQuery";
import { buildFilterTag } from "../model/libraryPresentation";
import type { PopoverLayout } from "./preview/useAnchoredPopover";
import AxisValueQuickList from "./AxisValueQuickList";

// チップの兄弟値ドロップダウン・「＋絞り込み」の値ステージ（TASK-182）が共有する
// 非ポータル版のポップオーバー本体。呼び出し側の `.mll-tagband` / チップは overflow を
// クリップしないため、軸レールのクイックオーバーレイ（AxisQuickOverlay）と違いポータル不要。

interface AxisValuePopoverPanelProps {
  axis: AxisId;
  layout: PopoverLayout;
  selectedTags: string[];
  onSelect: (tag: string, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  onClose: () => void;
  hint?: string;
}

export default function AxisValuePopoverPanel({
  axis,
  layout,
  selectedTags,
  onSelect,
  onClose,
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
        onClose={onClose}
        hint={hint}
      />
    </div>
  );
}
