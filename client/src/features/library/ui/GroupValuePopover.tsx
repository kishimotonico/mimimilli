import { createPortal } from "react-dom";
import { motion, useIsPresent } from "motion/react";
import { useAnchoredPopover } from "../../../shared/ui/useAnchoredPopover";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { useAxisFacetsQuery } from "../model/useAxisFacetsQuery";
import type { AxisId } from "../../../entities/library/types";
import AxisValueQuickList from "./AxisValueQuickList";

const POPOVER_WIDTH = 240;

interface GroupValuePopoverProps {
  folderId: string;
  axis: AxisId;
  axisLabel: string;
  anchorEl: HTMLElement;
  selectedValue: string;
  onSelectValue: (value: string) => void;
  onClose: () => void;
}

/** パンくずの値から、同じグループ分けの兄弟の値を選ぶ（ADR-0041）。件数は絞り込み無しで数える */
export default function GroupValuePopover({
  folderId,
  axis,
  axisLabel,
  anchorEl,
  selectedValue,
  onSelectValue,
  onClose,
}: GroupValuePopoverProps) {
  const isPresent = useIsPresent();
  const facetQuery = useAxisFacetsQuery(axis, { folderId });
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
      <AxisValueQuickList
        axis={axis}
        axisLabel={axisLabel}
        isOpen={isPresent}
        items={facetQuery.data ?? []}
        isLoading={facetQuery.isLoading}
        isError={facetQuery.isError}
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
