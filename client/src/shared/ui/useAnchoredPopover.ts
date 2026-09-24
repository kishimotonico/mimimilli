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
const ABOVE_PLACEMENT_GAP = 7;

export type { PopoverCloseReason };
export type PopoverPlacement = "below" | "right" | "above";
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
  /** スクロールで自動的に閉じる。既定は無効（呼び出し側が明示的に有効化する） */
  closeOnScroll?: boolean;
  /** フォーカスが境界外へ外れたら自動的に閉じる。既定は無効（呼び出し側が明示的に有効化する） */
  closeOnFocusOut?: boolean;
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
  closeOnScroll = false,
  closeOnFocusOut = false,
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
      // "right"/"above" はポータル先(document.body)がboundaryRefの外に出るため、
      // フローティングパネル自身を境界へ加えないと自分の中のクリックを外側扱いしてしまう。
      placement !== "below"
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
      : placement === "above"
        ? [offset(ABOVE_PLACEMENT_GAP), flip(boundaryOptions), shift(boundaryOptions)]
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

  const floatingPlacement =
    placement === "below" ? "bottom-start" : placement === "right" ? "right-start" : "top-end";

  const { context, floatingStyles, refs } = useFloating({
    open: isOpen,
    placement: floatingPlacement,
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
    if (!isOpen || !closeOnScroll) return;
    const handleScroll = () => close("scroll");
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen, closeOnScroll, close]);

  useEffect(() => {
    if (!isOpen || !closeOnFocusOut) return;
    const handleFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (
        next instanceof Node &&
        isInsideBoundaries(next, referenceRef, boundaryRef, dismissalBoundaryRefs)
      ) {
        return;
      }
      close("focus-out");
    };
    document.addEventListener("focusout", handleFocusOut);
    return () => document.removeEventListener("focusout", handleFocusOut);
  }, [isOpen, closeOnFocusOut, boundaryRef, dismissalBoundaryRefs, close]);

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
      // "above" は幅を持たない実寸のメニュー（例: 再生速度）を想定し、preferredWidth を強制しない。
      width:
        placement === "below" ? popoverWidth : placement === "right" ? preferredWidth : undefined,
    },
    containerWidth,
    close,
  };
}
