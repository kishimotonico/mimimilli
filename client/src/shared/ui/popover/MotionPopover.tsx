import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Popover,
  usePopover,
  type UsePopoverProps,
  type UsePopoverReturn,
} from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { cn } from "../../lib/cn";
import {
  POPOVER_CONTENT_SELECTOR,
  registerPopoverReturnTarget,
  resolveFocusReturnTarget,
} from "../../lib/focusReturnTarget";
import { ignoreComposingKey, isComposingKey } from "../layer/keys";
import { layerContainer } from "../layer/layerContainer";
import { useCloseOnAnchorScroll } from "../layer/useCloseOnAnchorScroll";
import { usePresenceLifetime } from "../layer/usePresenceLifetime";
import { useMotionVariants } from "../useMotionVariants";
import { popoverPanelClass } from "./popoverStyles";

const LAYER_CONTENT_SELECTOR = `${POPOVER_CONTENT_SELECTOR}, [data-scope="menu"][data-part="content"]`;
const popoverTriggerIds = new WeakMap<Element, string>();

function isInsideOwnLayerTree(target: EventTarget | null, own: HTMLElement): boolean {
  if (!(target instanceof Element)) return false;
  if (own.contains(target)) return true;

  let content = target.closest(LAYER_CONTENT_SELECTOR);
  const seen = new Set<Element>();
  while (content && !seen.has(content)) {
    seen.add(content);
    const doc = content.ownerDocument;
    const triggerId =
      content.getAttribute("data-scope") === "menu"
        ? content.getAttribute("aria-labelledby")
        : popoverTriggerIds.get(content);
    const trigger = triggerId
      ? doc.getElementById(triggerId)
      : doc.querySelector(`[aria-controls="${CSS.escape(content.id)}"]`);
    if (!trigger) return false;
    if (own.contains(trigger)) return true;
    content = trigger.closest(LAYER_CONTENT_SELECTOR);
  }
  return false;
}

type MotionPopoverProps = Omit<
  UsePopoverProps,
  "open" | "defaultOpen" | "modal" | "portalled" | "finalFocusEl" | "onOpenChange"
> & {
  open: boolean;
  onOpenChange: NonNullable<UsePopoverProps["onOpenChange"]>;
};

export interface MotionPopoverHandle {
  popover: UsePopoverReturn;
  present: boolean;
  onExitComplete: () => void;
  getAnchor: () => HTMLElement | null;
  bindContent: (content: HTMLDivElement | null) => void;
  resolveReturnTarget: () => HTMLElement | null;
  closeAndReturn: () => void;
  focusInitial: () => void;
}

export function useMotionPopover({
  open,
  onOpenChange,
  positioning,
  onEscapeKeyDown,
  onFocusOutside,
  initialFocusEl,
  ...rest
}: MotionPopoverProps): MotionPopoverHandle {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const triggerIdRef = useRef<string | undefined>(undefined);
  const anchorIdRef = useRef<string | undefined>(undefined);
  const getTrigger = useCallback(() => document.getElementById(triggerIdRef.current ?? ""), []);
  const getAnchor = useCallback(
    () => document.getElementById(anchorIdRef.current ?? "") ?? getTrigger(),
    [getTrigger],
  );
  const resolveReturnTarget = useCallback(() => {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      active.isConnected &&
      !contentRef.current?.contains(active)
    ) {
      return active;
    }
    return previousFocus.current?.isConnected ? previousFocus.current : getTrigger() ?? getAnchor();
  }, [getTrigger, getAnchor]);

  const popover = usePopover({
    ...rest,
    open,
    modal: false,
    portalled: true,
    positioning: { strategy: "fixed", gutter: 6, overflowPadding: 8, fitViewport: true, ...positioning },
    initialFocusEl,
    finalFocusEl: resolveReturnTarget,
    onOpenChange: (details) => {
      if (details.open !== open) onOpenChange(details);
    },
    onEscapeKeyDown: (event) => {
      if (isComposingKey(event)) event.preventDefault();
      else onEscapeKeyDown?.(event);
    },
    onFocusOutside: (event) => {
      onFocusOutside?.(event);
      if (
        !event.defaultPrevented &&
        contentRef.current &&
        isInsideOwnLayerTree(event.detail.target, contentRef.current)
      ) {
        event.preventDefault();
      }
    },
  });
  const triggerId = popover.getTriggerProps().id;
  const anchorId = popover.getAnchorProps().id;
  triggerIdRef.current = triggerId;
  anchorIdRef.current = anchorId;

  const bindContent = useCallback(
    (content: HTMLDivElement | null) => {
      contentRef.current = content;
      if (content) {
        registerPopoverReturnTarget(content, previousFocus);
        if (triggerId) popoverTriggerIds.set(content, triggerId);
      }
    },
    [triggerId],
  );

  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      previousFocus.current = resolveFocusReturnTarget(document.activeElement);
    }
    wasOpen.current = open;
  }, [open]);

  const closeOnScroll = useCallback(() => onOpenChange({ open: false }), [onOpenChange]);
  useCloseOnAnchorScroll(open, getAnchor, closeOnScroll);
  const lifetime = usePresenceLifetime(popover.open);

  return {
    popover,
    ...lifetime,
    getAnchor,
    bindContent,
    resolveReturnTarget,
    closeAndReturn() {
      if (!open) return;
      resolveReturnTarget()?.focus({ preventScroll: true });
      onOpenChange({ open: false });
    },
    focusInitial() {
      initialFocusEl?.()?.focus({ preventScroll: true });
    },
  };
}

const PopupContext = createContext<MotionPopoverHandle | null>(null);

export function MotionPopoverRoot({
  handle,
  children,
}: {
  handle: MotionPopoverHandle;
  children: ReactNode;
}) {
  return (
    <Popover.RootProvider value={handle.popover} present={handle.present}>
      <PopupContext.Provider value={handle}>{children}</PopupContext.Provider>
    </Popover.RootProvider>
  );
}

type PopoverPopupProps = Omit<ComponentPropsWithRef<typeof motion.div>, "inert" | "onKeyDownCapture"> & {
  origin?: string;
};

function Popup({
  container,
  bindContent,
  origin = "var(--transform-origin)",
  className,
  children,
  ...rest
}: PopoverPopupProps & {
  container: RefObject<HTMLElement | null>;
  bindContent: MotionPopoverHandle["bindContent"];
}) {
  const isPresent = useIsPresent();
  const { menuScale } = useMotionVariants();
  return (
    <Portal container={container}>
      <Popover.Positioner>
        <Popover.Content asChild ref={bindContent}>
          <motion.div
            {...rest}
            {...menuScale({ origin })}
            onKeyDownCapture={ignoreComposingKey}
            inert={!isPresent}
            className={cn(popoverPanelClass, className)}
          >
            {children}
          </motion.div>
        </Popover.Content>
      </Popover.Positioner>
    </Portal>
  );
}

export function PopoverPopup(props: PopoverPopupProps) {
  const handle = useContext(PopupContext);
  if (!handle) throw new Error("PopoverPopup must be used inside MotionPopoverRoot");
  return (
    <AnimatePresence onExitComplete={handle.onExitComplete}>
      {handle.popover.open && (
        <Popup
          key="popup"
          container={{ current: layerContainer(handle.getAnchor()) }}
          bindContent={handle.bindContent}
          {...props}
        />
      )}
    </AnimatePresence>
  );
}
