import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { useDismiss, useFloating, useInteractions } from "@floating-ui/react";
import { FOCUSABLE_SELECTOR } from "./focusable";

export type PopoverCloseReason = "escape" | "outside" | "direct";

export interface UsePopoverDismissalOptions {
  isOpen: boolean;
  onClose: (reason: PopoverCloseReason) => void;
  boundaryRef?: RefObject<HTMLElement | null>;
  additionalBoundaryRefs?: RefObject<HTMLElement | null>[];
  anchorRef: RefObject<HTMLElement | null>;
}

export interface UsePopoverDismissalResult {
  close: (reason?: PopoverCloseReason) => void;
}

export function mapDismissReason(reason?: string): PopoverCloseReason {
  if (reason === "escape-key") return "escape";
  if (reason === "outside-press") return "outside";
  return "direct";
}

export function isInsideBoundaries(
  target: Node,
  anchorRef: RefObject<HTMLElement | null>,
  boundaryRef: RefObject<HTMLElement | null> | undefined,
  additionalBoundaryRefs: RefObject<HTMLElement | null>[] | undefined,
): boolean {
  const primary = boundaryRef?.current ?? anchorRef.current;
  const boundaries = [primary, ...(additionalBoundaryRefs?.map((r) => r.current) ?? [])].filter(
    Boolean,
  ) as HTMLElement[];
  return boundaries.some((el) => el.contains(target));
}

function shouldRefocusPopoverAnchor(
  anchorRef: RefObject<HTMLElement | null>,
  boundaryRef: RefObject<HTMLElement | null> | undefined,
  additionalBoundaryRefs: RefObject<HTMLElement | null>[] | undefined,
): boolean {
  const active = document.activeElement;
  if (active === document.body) return true;
  if (!(active instanceof Node)) return false;
  return isInsideBoundaries(active, anchorRef, boundaryRef, additionalBoundaryRefs);
}

function refocusPopoverAnchor(anchorRef: RefObject<HTMLElement | null>): void {
  const anchor = anchorRef.current;
  if (!anchor) return;
  if (anchor.matches(FOCUSABLE_SELECTOR)) anchor.focus();
  else anchor.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
}

export function refocusPopoverAnchorIfNeeded(
  anchorRef: RefObject<HTMLElement | null>,
  boundaryRef: RefObject<HTMLElement | null> | undefined,
  additionalBoundaryRefs: RefObject<HTMLElement | null>[] | undefined,
): void {
  if (!shouldRefocusPopoverAnchor(anchorRef, boundaryRef, additionalBoundaryRefs)) return;
  refocusPopoverAnchor(anchorRef);
}

export function usePopoverDismissal({
  isOpen,
  onClose,
  boundaryRef,
  additionalBoundaryRefs,
  anchorRef,
}: UsePopoverDismissalOptions): UsePopoverDismissalResult {
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const closeInFlightRef = useRef(false);

  useEffect(() => {
    if (isOpen) closeInFlightRef.current = false;
  }, [isOpen]);

  const close = useCallback(
    (reason: PopoverCloseReason = "direct") => {
      if (!isOpenRef.current || closeInFlightRef.current) return;
      closeInFlightRef.current = true;
      refocusPopoverAnchorIfNeeded(anchorRef, boundaryRef, additionalBoundaryRefs);
      onClose(reason);
    },
    [onClose, boundaryRef, additionalBoundaryRefs, anchorRef],
  );

  const { context, refs } = useFloating({
    open: isOpen,
    onOpenChange: (open, _event, reason) => {
      if (!open) close(mapDismissReason(reason));
    },
  });

  useLayoutEffect(() => {
    refs.setReference(anchorRef.current);
  });

  const dismiss = useDismiss(context, {
    escapeKey: true,
    outsidePressEvent: "pointerdown",
    outsidePress(event) {
      const target = event.target;
      if (!(target instanceof Node)) return true;
      return !isInsideBoundaries(target, anchorRef, boundaryRef, additionalBoundaryRefs);
    },
  });

  useInteractions([dismiss]);

  return { close };
}
