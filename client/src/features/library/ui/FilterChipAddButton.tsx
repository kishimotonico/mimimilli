import { Popover } from "@ark-ui/react/popover";
import { motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
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
import { MENU_LABEL_CLASS, menuItemClass } from "../../../shared/ui/menu/menuStyles";
import {
  MotionPopoverRoot,
  PopoverPopup,
  useMotionPopover,
} from "../../../shared/ui/popover/MotionPopover";
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
  const onOpenChange = useCallback(({ open: nextOpen }: { open: boolean }) => {
    setOpen(nextOpen);
    if (!nextOpen) setPickedGroupBy(null);
  }, []);
  const popover = useMotionPopover({
    open,
    onOpenChange,
    positioning: { placement: "bottom-start" },
    initialFocusEl: () =>
      stageRef.current?.querySelector<HTMLElement>("input, [data-group-by-key]") ?? null,
    onEscapeKeyDown: (event) => {
      if (pickedGroupBy !== null) {
        event.preventDefault();
        backOrClose();
      }
    },
  });

  function backOrClose() {
    if (pickedGroupBy === null) {
      popover.closeAndReturn();
      return;
    }
    const key = groupByKey(pickedGroupBy);
    flushSync(() => setPickedGroupBy(null));
    stageRef.current
      ?.querySelector<HTMLElement>(`[data-group-by-key="${CSS.escape(key)}"]`)
      ?.focus({ preventScroll: true });
  }

  return (
    <MotionPopoverRoot handle={popover}>
      <Popover.Trigger asChild>
        <button type="button" className="mll-tagband__addbtn">
          <I.add size={11} />
          絞り込み
        </button>
      </Popover.Trigger>
      <PopoverPopup origin="top left" className="w-[240px]" aria-label="絞り込み">
        <motion.div
          key={groupByKey(pickedGroupBy)}
          ref={stageRef}
          initial={initial}
          animate={animate}
        >
          {pickedGroupBy === null ? (
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- GroupValueQuickList に合わせたボタン一覧
            <div
              role="listbox"
              aria-label="絞り込みの種類"
              className="max-h-[260px] overflow-y-auto"
            >
              {buildGroupByRows(tagPrefixes).map(({ groupBy, name }) => {
                const key = groupByKey(groupBy);
                return (
                  <button
                    key={key}
                    type="button"
                    data-group-by-key={key}
                    className={`${menuItemClass()} hover:bg-paper-2 hover:text-ink-0 focus-visible:bg-paper-2 focus-visible:text-ink-0`}
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
            </div>
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
