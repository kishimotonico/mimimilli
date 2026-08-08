import { useRef, useState } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import type { NormalizedTag, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { buildFacetAxisRows, getAxisLabel } from "../model/axisDefinitions";
import { useAnchoredPopover, type PopoverLayout } from "./preview/useAnchoredPopover";
import AxisValuePopoverPanel from "./AxisValuePopoverPanel";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { I } from "../../../shared/ui/Icon";

const POPOVER_WIDTH = 240;
const AND_ADD_HINT = "AND追加されます";

// チップ列の「＋絞り込み」（ADR-0012 §2）。軸→値の2段オーバーレイ。
// 既定は AND 追加（ヒント表示つき）、Ctrl/Cmd+クリックで置き換えへ反転する。
//
// 軸選択ステージ・値ステージともに、それぞれ独立した `<AnimatePresence>` で
// 条件レンダーする。軸を選ぶと軸選択ステージが退出し値ステージが入場する
// クロスフェードは、AnimatePresence が退出側の最後の props を凍結することで
// 成立し、呼び出し側でのpickedAxisの手動退避は不要。

interface FilterChipAddButtonProps {
  tagPrefixes: TagPrefix[];
  selectedTags: NormalizedTag[];
  onAddValue: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
}

function AxisPickerStage({
  layout,
  facetAxisRows,
  onPick,
}: {
  layout: PopoverLayout;
  facetAxisRows: ReturnType<typeof buildFacetAxisRows>;
  onPick: (axis: AxisId) => void;
}) {
  const isPresent = useIsPresent();
  const { popoverScale } = useMotionVariants();
  const variant = popoverScale({ origin: "top left" });

  return (
    <motion.div
      className="mll-qoverlay mll-qoverlay--inline"
      style={{ left: layout.left, width: layout.width }}
      inert={!isPresent}
      {...variant}
    >
      <div className="mll-qlist__hint">{AND_ADD_HINT}・軸を選択</div>
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- AxisValueQuickList の一覧と表現を揃えるため<select>ではなくボタン一覧にする */}
      <div className="mll-qlist__body" role="listbox" aria-label="絞り込む軸">
        {facetAxisRows.map((ax) => (
          <button
            key={ax.id}
            type="button"
            className="mll-qlist__item"
            onClick={() => onPick(ax.id)}
          >
            <span className="nm">{ax.name}</span>
            <I.chev size={11} />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export default function FilterChipAddButton({
  tagPrefixes,
  selectedTags,
  onAddValue,
}: FilterChipAddButtonProps) {
  const [open, setOpen] = useState(false);
  const [pickedAxis, setPickedAxis] = useState<AxisId | null>(null);
  const pickedAxisRef = useRef(pickedAxis);
  pickedAxisRef.current = pickedAxis;

  const { anchorRef, layout, close } = useAnchoredPopover({
    isOpen: open,
    preferredWidth: POPOVER_WIDTH,
    onClose: (reason) => {
      if (reason === "escape" && pickedAxisRef.current !== null) {
        setPickedAxis(null);
      } else {
        setOpen(false);
        setPickedAxis(null);
      }
    },
  });

  const facetAxisRows = buildFacetAxisRows(tagPrefixes);

  return (
    <div ref={anchorRef} className="relative inline-flex">
      <button
        type="button"
        className="mll-tagband__addbtn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <I.add size={11} />
        絞り込み
      </button>
      <AnimatePresence>
        {open && pickedAxis === null && (
          <AxisPickerStage layout={layout} facetAxisRows={facetAxisRows} onPick={setPickedAxis} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pickedAxis !== null && (
          <AxisValuePopoverPanel
            key={pickedAxis}
            axis={pickedAxis}
            axisLabel={getAxisLabel(pickedAxis, tagPrefixes)}
            layout={layout}
            selectedTags={selectedTags}
            hint={AND_ADD_HINT}
            onSelect={(tag, opts) => {
              onAddValue(tag, opts);
              close();
            }}
            close={close}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
