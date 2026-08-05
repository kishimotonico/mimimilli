import { useState } from "react";
import type { NormalizedTag, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { buildFacetAxisRows } from "../model/axisDefinitions";
import { useAnchoredPopover } from "./preview/useAnchoredPopover";
import AxisValuePopoverPanel from "./AxisValuePopoverPanel";
import { I } from "../../../shared/ui/Icon";

const POPOVER_WIDTH = 240;
const AND_ADD_HINT = "AND追加されます";

// チップ列の「＋絞り込み」（ADR-0012 §2）。軸→値の2段オーバーレイ。
// 既定は AND 追加（ヒント表示つき）、Ctrl/Cmd+クリックで置き換えへ反転する。

interface FilterChipAddButtonProps {
  tagPrefixes: TagPrefix[];
  selectedTags: NormalizedTag[];
  onAddValue: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
}

export default function FilterChipAddButton({
  tagPrefixes,
  selectedTags,
  onAddValue,
}: FilterChipAddButtonProps) {
  const [open, setOpen] = useState(false);
  const [pickedAxis, setPickedAxis] = useState<AxisId | null>(null);

  const close = () => {
    setOpen(false);
    setPickedAxis(null);
  };

  const { anchorRef, layout } = useAnchoredPopover({
    isOpen: open,
    preferredWidth: POPOVER_WIDTH,
    onOutsideClick: close,
    onEscape: () => (pickedAxis !== null ? setPickedAxis(null) : close()),
  });

  const facetAxisRows = buildFacetAxisRows(tagPrefixes);

  return (
    <div ref={anchorRef} className="relative inline-flex">
      <button
        type="button"
        className="mll-tagband__addbtn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <I.add size={11} />
        絞り込み
      </button>
      {open && pickedAxis === null && (
        <div
          className="mll-qoverlay mll-qoverlay--inline"
          style={{ left: layout.left, width: layout.width }}
        >
          <div className="mll-qlist__hint">{AND_ADD_HINT}・軸を選択</div>
          {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- AxisValueQuickList の一覧と表現を揃えるため<select>ではなくボタン一覧にする */}
          <div className="mll-qlist__body" role="listbox" aria-label="絞り込む軸">
            {facetAxisRows.map((ax) => (
              <button
                key={ax.id}
                type="button"
                className="mll-qlist__item"
                onClick={() => setPickedAxis(ax.id)}
              >
                <span className="nm">{ax.name}</span>
                <I.chev size={11} />
              </button>
            ))}
          </div>
        </div>
      )}
      {open && pickedAxis !== null && (
        <AxisValuePopoverPanel
          axis={pickedAxis}
          layout={layout}
          selectedTags={selectedTags}
          hint={AND_ADD_HINT}
          onSelect={(tag, opts) => {
            onAddValue(tag, opts);
            close();
          }}
          onClose={close}
        />
      )}
    </div>
  );
}
