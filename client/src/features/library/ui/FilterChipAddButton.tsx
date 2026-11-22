import { useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import type { GroupBy, NormalizedTag, TagPrefix } from "@mimimilli/shared";
import {
  buildGroupByRows,
  getGroupByLabel,
} from "../../../entities/library/smartFolderDefinitions";
import {
  useAnchoredPopover,
  type AnchoredPopoverFloatingRefCallback,
} from "../../../shared/ui/useAnchoredPopover";
import { buildFilterTag } from "../model/libraryPresentation";
import { groupByKey } from "../../../entities/smart-folder/groupByKey";
import GroupValuePopoverPanel from "./GroupValuePopoverPanel";
import type { GroupValueScope } from "../model/useGroupValuesQuery";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { I } from "../../../shared/ui/Icon";

const POPOVER_WIDTH = 240;

// チップ列の「＋絞り込み」（ADR-0012 §2）。グループ分け→値の2段オーバーレイ。
// 選んだ値はチップとして足す。候補は定義済みの prefix 全部・タグ・追加年（ADR-0041）。
//
// グループ分け選択ステージ・値ステージともに、それぞれ独立した `<AnimatePresence>` で
// 条件レンダーする。グループ分けを選ぶとグループ分け選択ステージが退出し値ステージが入場する
// クロスフェードは、AnimatePresence が退出側の最後の props を凍結することで
// 成立し、呼び出し側でのpickedGroupByの手動退避は不要。

interface FilterChipAddButtonProps {
  tagPrefixes: TagPrefix[];
  selectedTags: NormalizedTag[];
  /** 候補を数える母集団（開いている一覧の条件・値・チップ・検索語） */
  scope: GroupValueScope;
  onAddValue: (tag: NormalizedTag) => void;
}

function GroupByPickerStage({
  floatingStyles,
  setFloating,
  groupByRows,
  onPick,
}: {
  floatingStyles: CSSProperties;
  setFloating: AnchoredPopoverFloatingRefCallback;
  groupByRows: ReturnType<typeof buildGroupByRows>;
  onPick: (groupBy: GroupBy) => void;
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
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- GroupValueQuickList の一覧と表現を揃えるため<select>ではなくボタン一覧にする */}
      <div className="mll-qlist__body" role="listbox" aria-label="絞り込みの種類">
        {groupByRows.map((ax) => (
          <button
            key={groupByKey(ax.groupBy)}
            type="button"
            className="mll-qlist__item"
            onClick={() => onPick(ax.groupBy)}
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
  const [pickedGroupBy, setPickedGroupBy] = useState<GroupBy | null>(null);
  const pickedGroupByRef = useRef(pickedGroupBy);
  pickedGroupByRef.current = pickedGroupBy;

  const { setReference, setFloating, floatingStyles, close } = useAnchoredPopover({
    isOpen: open,
    preferredWidth: POPOVER_WIDTH,
    onClose: (reason) => {
      if (reason === "escape" && pickedGroupByRef.current !== null) {
        setPickedGroupBy(null);
      } else {
        setOpen(false);
        setPickedGroupBy(null);
      }
    },
  });

  const groupByRows = buildGroupByRows(tagPrefixes);

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
        {open && pickedGroupBy === null && (
          <GroupByPickerStage
            floatingStyles={floatingStyles}
            setFloating={setFloating}
            groupByRows={groupByRows}
            onPick={setPickedGroupBy}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pickedGroupBy !== null && (
          <GroupValuePopoverPanel
            key={groupByKey(pickedGroupBy)}
            groupBy={pickedGroupBy}
            groupByLabel={getGroupByLabel(pickedGroupBy, tagPrefixes)}
            // 件数は現在の絞り込み込みの集計にする（「追加したら何件になるか」を示す）
            scope={scope}
            position="inline"
            origin="top left"
            floatingStyles={floatingStyles}
            setFloating={setFloating}
            isSelected={(value) => selectedTags.includes(buildFilterTag(pickedGroupBy, value))}
            onSelect={(item) => {
              onAddValue(buildFilterTag(pickedGroupBy, item.value));
              close();
            }}
            close={close}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
