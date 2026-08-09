import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import type { Boundary } from "@floating-ui/react";
import {
  isInsideBoundaries,
  mapDismissReason,
  refocusPopoverAnchorIfNeeded,
  type PopoverCloseReason,
} from "./usePopoverDismissal";

const POPOVER_MARGIN = 8;
const RIGHT_PLACEMENT_GAP = 6;

export type { PopoverCloseReason };
export type PopoverPlacement = "below" | "right";
export type PopoverContainerResolver = (anchor: HTMLElement) => HTMLElement | null;

const defaultContainerResolver: PopoverContainerResolver = (anchor) =>
  (anchor.closest(".mle-prv__meta") ??
    anchor.closest(".mle-prv__body") ??
    null) as HTMLElement | null;

function readContainerWidth(boundary: Boundary): number {
  if (boundary instanceof HTMLElement) {
    const rectWidth = boundary.getBoundingClientRect().width;
    if (rectWidth > 0) return rectWidth;
    const layoutWidth = boundary.clientWidth || boundary.offsetWidth;
    if (layoutWidth > 0) return layoutWidth;
  }
  return window.innerWidth;
}

export interface UseAnchoredPopoverOptions {
  isOpen: boolean;
  preferredWidth: number;
  onClose: (reason: PopoverCloseReason) => void;
  boundaryRef?: RefObject<HTMLElement | null>;
  additionalBoundaryRefs?: RefObject<HTMLElement | null>[];
  getContainer?: PopoverContainerResolver;
  placement?: PopoverPlacement;
  referenceElement?: HTMLElement | null;
}

export type AnchoredPopoverFloatingRefCallback = (node: HTMLElement | null) => (() => void) | void;

export interface UseAnchoredPopoverResult {
  setReference: (node: HTMLElement | null) => void;
  setFloating: AnchoredPopoverFloatingRefCallback;
  floatingStyles: CSSProperties;
  containerWidth: number;
  close: (reason?: PopoverCloseReason) => void;
}

export function useAnchoredPopover({
  isOpen,
  preferredWidth,
  onClose,
  boundaryRef,
  additionalBoundaryRefs,
  getContainer = defaultContainerResolver,
  placement = "below",
  referenceElement,
}: UseAnchoredPopoverOptions): UseAnchoredPopoverResult {
  const referenceRef = useRef<HTMLElement | null>(null);
  const floatingNodeRef = useRef<HTMLElement | null>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const closeInFlightRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(preferredWidth);
  const [popoverWidth, setPopoverWidth] = useState(preferredWidth);

  const floatingBoundaryRef = useRef<HTMLElement | null>(null);
  const dismissalBoundaryRefs = useMemo(
    () =>
      placement === "right"
        ? [...(additionalBoundaryRefs ?? []), floatingBoundaryRef]
        : additionalBoundaryRefs,
    [placement, additionalBoundaryRefs],
  );

  useEffect(() => {
    if (isOpen) closeInFlightRef.current = false;
  }, [isOpen]);

  const close = useCallback(
    (reason: PopoverCloseReason = "direct") => {
      if (!isOpenRef.current || closeInFlightRef.current) return;
      closeInFlightRef.current = true;
      refocusPopoverAnchorIfNeeded(referenceRef, boundaryRef, dismissalBoundaryRefs);
      onClose(reason);
    },
    [onClose, boundaryRef, dismissalBoundaryRefs],
  );

  const resolveBoundary = (): Boundary => {
    const reference = referenceElement ?? referenceRef.current;
    if (!reference) return "clippingAncestors";
    return getContainer(reference) ?? "clippingAncestors";
  };

  const boundaryOptions = () => ({ padding: POPOVER_MARGIN, boundary: resolveBoundary() });

  const trackContainerWidth = {
    name: "trackContainerWidth",
    fn() {
      const boundary = resolveBoundary();
      if (boundary instanceof HTMLElement) {
        setContainerWidth(readContainerWidth(boundary));
      }
      return {};
    },
  };

  const middleware =
    placement === "right"
      ? [offset(RIGHT_PLACEMENT_GAP), shift(boundaryOptions), trackContainerWidth]
      : [
          offset(RIGHT_PLACEMENT_GAP),
          flip(boundaryOptions),
          shift(boundaryOptions),
          size(() => ({
            ...boundaryOptions(),
            apply({ availableWidth }) {
              const width = Math.min(preferredWidth, availableWidth);
              setPopoverWidth(width);
              const boundary = resolveBoundary();
              if (boundary instanceof HTMLElement) {
                setContainerWidth(readContainerWidth(boundary));
              }
            },
          })),
        ];

  const { context, floatingStyles, refs } = useFloating({
    open: isOpen,
    placement: placement === "below" ? "bottom-start" : "right-start",
    strategy: placement === "below" ? "absolute" : "fixed",
    transform: false,
    elements: {
      reference: referenceElement ?? undefined,
    },
    whileElementsMounted: autoUpdate,
    middleware,
    onOpenChange: (open, _event, reason) => {
      if (!open) close(mapDismissReason(reason));
    },
  });

  const setReference = useCallback(
    (node: HTMLElement | null) => {
      referenceRef.current = node;
      refs.setReference(node);
      if (node) {
        setContainerWidth(readContainerWidth(getContainer(node) ?? "clippingAncestors"));
      }
    },
    [refs, getContainer],
  );

  useLayoutEffect(() => {
    referenceRef.current = referenceElement ?? referenceRef.current;
  }, [referenceElement]);

  const setFloating = useCallback(
    (node: HTMLElement | null) => {
      if (!node) return;
      floatingNodeRef.current = node;
      floatingBoundaryRef.current = node;
      refs.setFloating(node);
      return () => {
        if (floatingNodeRef.current !== node) return;
        floatingNodeRef.current = null;
        floatingBoundaryRef.current = null;
        refs.setFloating(null);
      };
    },
    [refs],
  );

  const dismiss = useDismiss(context, {
    escapeKey: true,
    outsidePressEvent: "pointerdown",
    outsidePress(event) {
      const target = event.target;
      if (!(target instanceof Node)) return true;
      return !isInsideBoundaries(target, referenceRef, boundaryRef, dismissalBoundaryRefs);
    },
  });

  useInteractions([dismiss]);

  useEffect(() => {
    if (!isOpen) return;
    if (placement === "right") {
      setPopoverWidth(preferredWidth);
    }
  }, [isOpen, placement, preferredWidth]);

  useEffect(() => {
    if (!isOpen || !referenceElement) return;
    setContainerWidth(readContainerWidth(getContainer(referenceElement) ?? "clippingAncestors"));
  }, [isOpen, referenceElement, getContainer]);

  return {
    setReference,
    setFloating,
    floatingStyles: {
      ...floatingStyles,
      width: placement === "below" ? popoverWidth : preferredWidth,
    },
    containerWidth,
    close,
  };
}
