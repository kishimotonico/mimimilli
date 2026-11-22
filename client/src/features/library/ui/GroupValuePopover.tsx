import { createPortal } from "react-dom";
import type { GroupBy } from "@mimimilli/shared";
import { motion, useIsPresent } from "motion/react";
import { useAnchoredPopover } from "../../../shared/ui/useAnchoredPopover";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { useGroupValuesQuery } from "../model/useGroupValuesQuery";
import GroupValueQuickList from "./GroupValueQuickList";

const POPOVER_WIDTH = 240;

interface GroupValuePopoverProps {
  folderId: string;
  groupBy: GroupBy;
  groupByLabel: string;
  anchorEl: HTMLElement;
  selectedValue: string;
  onSelectValue: (value: string) => void;
  onClose: () => void;
}

/** パンくずの値から、同じグループ分けの兄弟の値を選ぶ（ADR-0041）。件数は絞り込み無しで数える */
export default function GroupValuePopover({
  folderId,
  groupBy,
  groupByLabel,
  anchorEl,
  selectedValue,
  onSelectValue,
  onClose,
}: GroupValuePopoverProps) {
  const isPresent = useIsPresent();
  const groupValuesQuery = useGroupValuesQuery(groupBy, { folderId });
  const { popoverScale } = useMotionVariants();
  const variant = popoverScale({ origin: "top left" });
  const { setFloating, floatingStyles, close } = useAnchoredPopover({
    isOpen: isPresent,
    preferredWidth: POPOVER_WIDTH,
    onClose: () => onClose(),
    getContainer: (el) => el.closest(".mle-app"),
    placement: "below",
    referenceElement: anchorEl,
  });

  return createPortal(
    <motion.div
      ref={setFloating}
      {...variant}
      className="mll-qoverlay mll-qoverlay--inline"
      style={floatingStyles}
      inert={!isPresent}
    >
      <GroupValueQuickList
        groupBy={groupBy}
        groupByLabel={groupByLabel}
        isOpen={isPresent}
        items={groupValuesQuery.data ?? []}
        isLoading={groupValuesQuery.isLoading}
        isError={groupValuesQuery.isError}
        isSelected={(value) => value === selectedValue}
        onSelect={(item) => {
          onSelectValue(item.value);
          close();
        }}
        close={close}
      />
    </motion.div>,
    document.body,
  );
}
