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
import type { Boundary, Placement } from "@floating-ui/react";
import { usePopoverEscape } from "./usePopoverEscape";
import {
  isInsideBoundaries,
  mapDismissReason,
  refocusPopoverAnchorIfNeeded,
  type PopoverCloseReason,
} from "./usePopoverDismissal";

const POPOVER_MARGIN = 8;

interface PlacementSpec {
  side: Placement;
  strategy: "absolute" | "fixed";
  gap: number;
  /** 空きが足りなければ反対側へ反転する */
  flip: boolean;
  /** fit: 境界の空きに収める / preferred: 希望の幅 / auto: 内容に任せる */
  width: "fit" | "preferred" | "auto";
  /** 境界の幅だけを追う */
  trackContainerWidth: boolean;
}

const PLACEMENTS = {
  below: {
    side: "bottom-start",
    strategy: "absolute",
    gap: 6,
    flip: true,
    width: "fit",
    trackContainerWidth: false,
  },
  right: {
    side: "right-start",
    strategy: "fixed",
    gap: 6,
    flip: false,
    width: "preferred",
    trackContainerWidth: true,
  },
  above: {
    side: "top-end",
    strategy: "fixed",
    gap: 7,
    flip: true,
    width: "auto",
    trackContainerWidth: false,
  },
  belowEnd: {
    side: "bottom-end",
    strategy: "fixed",
    gap: 5,
    flip: true,
    width: "auto",
    trackContainerWidth: false,
  },
} satisfies Record<string, PlacementSpec>;

export type { PopoverCloseReason };
export type PopoverPlacement = keyof typeof PLACEMENTS;
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

  const spec: PlacementSpec = PLACEMENTS[placement];
  const middleware = [
    offset(spec.gap),
    ...(spec.flip ? [flip(boundaryOptions)] : []),
    shift(boundaryOptions),
    ...(spec.trackContainerWidth ? [trackContainerWidth] : []),
    ...(spec.width === "fit"
      ? [
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
        ]
      : []),
  ];

  const { context, floatingStyles, refs } = useFloating({
    open: isOpen,
    placement: spec.side,
    strategy: spec.strategy,
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
    escapeKey: false,
    outsidePressEvent: "pointerdown",
    outsidePress(event) {
      const target = event.target;
      if (!(target instanceof Node)) return true;
      return !isInsideBoundaries(target, referenceRef, boundaryRef, dismissalBoundaryRefs);
    },
  });

  useInteractions([dismiss]);

  usePopoverEscape(
    isOpen,
    () => referenceElement ?? referenceRef.current,
    () => close("escape"),
  );

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
    if (spec.width === "preferred") {
      setPopoverWidth(preferredWidth);
    }
  }, [isOpen, spec.width, preferredWidth]);

  useEffect(() => {
    if (!isOpen || !referenceElement) return;
    setContainerWidth(readContainerWidth(getContainer(referenceElement) ?? "clippingAncestors"));
  }, [isOpen, referenceElement, getContainer]);

  return {
    setReference,
    setFloating,
    floatingStyles: {
      ...floatingStyles,
      width: { fit: popoverWidth, preferred: preferredWidth, auto: undefined }[spec.width],
    },
    containerWidth,
    close,
  };
}
