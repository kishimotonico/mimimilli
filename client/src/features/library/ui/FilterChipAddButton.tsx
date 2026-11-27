import { motion } from "motion/react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  defaultGroupSort,
  type GroupBy,
  type NormalizedTag,
  type TagPrefix,
} from "@mimimilli/shared";
import {
  buildGroupByRows,
  getGroupByLabel,
} from "../../../entities/library/smartFolderDefinitions";
import { MENU_LABEL_CLASS } from "../../../shared/ui/menu/menuStyles";
import {
  MotionPopoverRoot,
  MotionPopoverTrigger,
  PopoverPopup,
  useMotionPopover,
} from "../../../shared/ui/popover/MotionPopover";
import { popoverListItemClass } from "../../../shared/ui/popover/popoverStyles";
import { buildFilterTag } from "../model/libraryPresentation";
import { groupByKey } from "../../../entities/smart-folder/groupByKey";
import GroupValueQuickList from "./GroupValueQuickList";
import { useGroupValuesQuery, type GroupValueScope } from "../model/useGroupValuesQuery";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { I } from "../../../shared/ui/Icon";

// チップ列の「＋絞り込み」（ADR-0012 §2）。グループ分け→値の2段を同じ層に表示する。

interface FilterChipAddButtonProps {
  tagPrefixes: TagPrefix[];
  selectedTags: NormalizedTag[];
  /** 候補を数える母集団（開いている一覧の条件・値・チップ・検索語） */
  scope: GroupValueScope;
  onAddValue: (tag: NormalizedTag) => void;
}

function GroupValueStage({
  groupBy,
  groupByLabel,
  scope,
  selectedTags,
  onSelect,
}: {
  groupBy: GroupBy;
  groupByLabel: string;
  scope: GroupValueScope;
  selectedTags: NormalizedTag[];
  onSelect: (tag: NormalizedTag) => void;
}) {
  const [sort, setSort] = useState(() => defaultGroupSort(groupBy));
  // いまの絞り込みにこの値を追加した場合の件数を出す。
  const values = useGroupValuesQuery(groupBy, scope, sort);

  return (
    <GroupValueQuickList
      groupBy={groupBy}
      groupByLabel={groupByLabel}
      items={values.data ?? []}
      sort={sort}
      onSortChange={setSort}
      isLoading={values.isLoading}
      isError={values.isError}
      isSelected={(value) => selectedTags.includes(buildFilterTag(groupBy, value))}
      onSelect={(item) => onSelect(buildFilterTag(groupBy, item.value))}
    />
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
  const stageRef = useRef<HTMLDivElement>(null);
  const { fade } = useMotionVariants();
  const { initial, animate } = fade();
  const popover = useMotionPopover({
    open,
    onOpenChange: ({ open: nextOpen }) => {
      setOpen(nextOpen);
      if (!nextOpen) setPickedGroupBy(null);
    },
    positioning: { placement: "bottom-start" },
    initialFocusEl: () =>
      stageRef.current?.querySelector<HTMLElement>("input, [data-group-by-key]") ?? null,
    onEscapeKeyDown: (event) => {
      if (pickedGroupBy !== null) {
        event.preventDefault();
        backToGroupBy(pickedGroupBy);
      }
    },
  });

  function backToGroupBy(groupBy: GroupBy) {
    const key = groupByKey(groupBy);
    flushSync(() => setPickedGroupBy(null));
    stageRef.current
      ?.querySelector<HTMLElement>(`[data-group-by-key="${CSS.escape(key)}"]`)
      ?.focus({ preventScroll: true });
  }

  return (
    <MotionPopoverRoot handle={popover}>
      <MotionPopoverTrigger>
        <button type="button" className="mll-tagband__addbtn">
          <I.add size={11} />
          絞り込み
        </button>
      </MotionPopoverTrigger>
      <PopoverPopup className="w-[240px]" aria-label="絞り込み">
        <motion.div
          key={groupByKey(pickedGroupBy)}
          ref={stageRef}
          initial={initial}
          animate={animate}
        >
          {pickedGroupBy === null ? (
            <fieldset
              aria-label="絞り込みの種類"
              className="m-0 max-h-[260px] overflow-y-auto border-0 p-0"
            >
              {buildGroupByRows(tagPrefixes).map(({ groupBy, name }) => {
                const key = groupByKey(groupBy);
                return (
                  <button
                    key={key}
                    type="button"
                    data-group-by-key={key}
                    className={popoverListItemClass}
                    onClick={() => {
                      flushSync(() => setPickedGroupBy(groupBy));
                      popover.focusInitial();
                    }}
                  >
                    <span className={MENU_LABEL_CLASS}>{name}</span>
                    <I.chev size={11} />
                  </button>
                );
              })}
            </fieldset>
          ) : (
            <GroupValueStage
              groupBy={pickedGroupBy}
              groupByLabel={getGroupByLabel(pickedGroupBy, tagPrefixes)}
              scope={scope}
              selectedTags={selectedTags}
              onSelect={(tag) => {
                popover.closeAndReturn();
                onAddValue(tag);
              }}
            />
          )}
        </motion.div>
      </PopoverPopup>
    </MotionPopoverRoot>
  );
}
