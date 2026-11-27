import { useRef, useState } from "react";
import type { GroupBy, GroupSortId } from "@mimimilli/shared";
import {
  MotionPopoverRoot,
  PopoverPopup,
  useMotionPopover,
} from "../../../shared/ui/popover/MotionPopover";
import type { HoverGroupPanelHandlers } from "../../../shared/lib/useHoverGroupCoordinator";
import { useGroupValuesQuery, type GroupValueScope } from "../model/useGroupValuesQuery";
import GroupValueQuickList from "./GroupValueQuickList";

interface GroupValueListProps {
  scope: GroupValueScope;
  groupBy: GroupBy;
  groupByLabel: string;
  groupSort: GroupSortId;
  selectedValue: string | null;
  onSelectValue: (value: string) => void;
  onAddValue?: (value: string) => void;
}

interface GroupValuePopoverProps {
  placement: "right" | "below";
  open: boolean;
  triggerId: string;
  anchorEl: HTMLElement | null;
  restoreFocus?: boolean;
  list: GroupValueListProps | null;
  onClose: () => void;
  panelHandlers?: HoverGroupPanelHandlers;
  onPanelElChange?: (el: HTMLElement | null) => void;
  onReturnTargetLost?: () => void;
}

function GroupValueList({
  scope,
  groupBy,
  groupByLabel,
  groupSort,
  selectedValue,
  onSelectValue,
  onAddValue,
}: GroupValueListProps) {
  const [sort, setSort] = useState(groupSort);
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
      isSelected={(value) => value === selectedValue}
      onSelect={(item) => onSelectValue(item.value)}
      onAdd={onAddValue && ((item) => onAddValue(item.value))}
    />
  );
}

export default function GroupValuePopover({
  placement,
  open,
  triggerId,
  anchorEl,
  restoreFocus,
  list,
  onClose,
  panelHandlers,
  onPanelElChange,
  onReturnTargetLost,
}: GroupValuePopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const right = placement === "right";
  const popover = useMotionPopover({
    open,
    ids: { trigger: triggerId },
    restoreFocus,
    positioning: {
      placement: right ? "right-start" : "bottom-start",
      flip: !right,
      getAnchorRect: () => anchorEl?.getBoundingClientRect() ?? null,
    },
    initialFocusEl: () => panelRef.current?.querySelector("input") ?? null,
    onOpenChange: ({ open: nextOpen }) => {
      if (!nextOpen) onClose();
    },
  });

  return (
    <MotionPopoverRoot handle={popover}>
      <PopoverPopup
        ref={(el) => {
          panelRef.current = el;
          onPanelElChange?.(el);
        }}
        className={right ? "w-[280px]" : "w-[240px]"}
        aria-label={list?.groupByLabel}
        {...panelHandlers}
      >
        {list && (
          <GroupValueList
            {...list}
            onSelectValue={(value) => {
              const returnTarget = popover.resolveReturnTarget();
              popover.closeAndReturn();
              list.onSelectValue(value);
              if (!returnTarget?.isConnected) onReturnTargetLost?.();
            }}
          />
        )}
      </PopoverPopup>
    </MotionPopoverRoot>
  );
}
