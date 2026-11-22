import { useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import type { NormalizedTag, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../../../entities/library/types";
import { buildFacetAxisRows, getAxisLabel } from "../../../entities/library/axisDefinitions";
import {
  useAnchoredPopover,
  type AnchoredPopoverFloatingRefCallback,
} from "../../../shared/ui/useAnchoredPopover";
import AxisValuePopoverPanel from "./AxisValuePopoverPanel";
import type { FacetScope } from "../model/useAxisFacetsQuery";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { I } from "../../../shared/ui/Icon";

const POPOVER_WIDTH = 240;

// チップ列の「＋絞り込み」（ADR-0012 §2）。軸→値の2段オーバーレイ。
// 選んだ値はチップとして足す。候補は定義済みの prefix 全部・タグ・追加年（ADR-0041）。
//
// 軸選択ステージ・値ステージともに、それぞれ独立した `<AnimatePresence>` で
// 条件レンダーする。軸を選ぶと軸選択ステージが退出し値ステージが入場する
// クロスフェードは、AnimatePresence が退出側の最後の props を凍結することで
// 成立し、呼び出し側でのpickedAxisの手動退避は不要。

interface FilterChipAddButtonProps {
  tagPrefixes: TagPrefix[];
  selectedTags: NormalizedTag[];
  /** 候補を数える母集団（開いている一覧の条件・値・チップ・検索語） */
  scope: FacetScope;
  onAddValue: (tag: NormalizedTag) => void;
}

function AxisPickerStage({
  floatingStyles,
  setFloating,
  facetAxisRows,
  onPick,
}: {
  floatingStyles: CSSProperties;
  setFloating: AnchoredPopoverFloatingRefCallback;
  facetAxisRows: ReturnType<typeof buildFacetAxisRows>;
  onPick: (axis: AxisId) => void;
}) {
  const isPresent = useIsPresent();
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
  scope,
  onAddValue,
}: FilterChipAddButtonProps) {
  const [open, setOpen] = useState(false);
  const [pickedAxis, setPickedAxis] = useState<AxisId | null>(null);
  const pickedAxisRef = useRef(pickedAxis);
  pickedAxisRef.current = pickedAxis;

  const { setReference, setFloating, floatingStyles, close } = useAnchoredPopover({
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
    <div ref={setReference} className="relative inline-flex">
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
          <AxisPickerStage
            floatingStyles={floatingStyles}
            setFloating={setFloating}
            facetAxisRows={facetAxisRows}
            onPick={setPickedAxis}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pickedAxis !== null && (
          <AxisValuePopoverPanel
            key={pickedAxis}
            axis={pickedAxis}
            axisLabel={getAxisLabel(pickedAxis, tagPrefixes)}
            floatingStyles={floatingStyles}
            setFloating={setFloating}
            selectedTags={selectedTags}
            // 件数は現在の絞り込み込みの集計にする（「追加したら何件になるか」を示す）
            scope={scope}
            onSelect={(tag) => {
              onAddValue(tag);
              close();
            }}
            close={close}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
