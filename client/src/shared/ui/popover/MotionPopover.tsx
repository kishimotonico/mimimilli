import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
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
import { resolveFocusReturnTarget } from "../layer/focusReturnTarget";
import { ignoreComposingKey, isComposingKey } from "../layer/keys";
import { layerContainer, registerPopoverReturnTarget } from "../layer/layerDom";
import { layerPositioning } from "../layer/layerPositioning";
import { disabledTriggerProps, POPOVER_OPEN_KEYS } from "../layer/layerTrigger";
import { useCloseOnAnchorScroll } from "../layer/useCloseOnAnchorScroll";
import { useCloseOnParentExit } from "../layer/useCloseOnParentExit";
import { usePresenceLifetime } from "../layer/usePresenceLifetime";
import { useMotionVariants } from "../useMotionVariants";
import { popoverPanelClass } from "./popoverStyles";

type MotionPopoverProps = Omit<
  UsePopoverProps,
  "open" | "defaultOpen" | "modal" | "portalled" | "finalFocusEl" | "onOpenChange"
> & {
  open: boolean;
  onOpenChange: NonNullable<UsePopoverProps["onOpenChange"]>;
  /** 無効。フォーカスを残したまま、開く操作（ポインター・キーボード）を受けなくする */
  disabled?: boolean;
  /** 親が AnimatePresence で退出に入ったら閉じる */
  closeOnParentExit?: boolean;
};

const INTERNALS = Symbol("motionPopoverInternals");

function findTrigger(popover: UsePopoverReturn | null): HTMLElement | null {
  return popover ? document.getElementById(popover.getTriggerProps().id ?? "") : null;
}

function findAnchor(popover: UsePopoverReturn | null): HTMLElement | null {
  const anchor = popover ? document.getElementById(popover.getAnchorProps().id ?? "") : null;
  return anchor ?? findTrigger(popover);
}

interface PopoverInternals {
  popover: UsePopoverReturn;
  present: boolean;
  onExitComplete: () => void;
  getAnchor: () => HTMLElement | null;
  bindContent: (content: HTMLDivElement | null) => void;
  triggerProps: ReturnType<typeof disabledTriggerProps>;
}

export interface MotionPopoverHandle {
  open: boolean;
  /** フォーカスを戻し先へ移してから閉じる */
  closeAndReturn: () => void;
  /** initialFocusEl の要素へフォーカスを移す */
  focusInitial: () => void;
  readonly [INTERNALS]: PopoverInternals;
}

export function useMotionPopover({
  open,
  onOpenChange,
  positioning,
  onEscapeKeyDown,
  initialFocusEl,
  disabled = false,
  closeOnParentExit = false,
  ...rest
}: MotionPopoverProps): MotionPopoverHandle {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<UsePopoverReturn | null>(null);
  const resolveReturnTarget = useCallback(() => {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      // Chromium は backdrop や dialog 内の非フォーカス領域を押すと dialog にフォーカスする。
      !(active instanceof HTMLDialogElement && active.contains(contentRef.current)) &&
      active.isConnected &&
      !contentRef.current?.contains(active)
    ) {
      return active;
    }
    return previousFocus.current?.isConnected
      ? previousFocus.current
      : (findTrigger(popoverRef.current) ?? findAnchor(popoverRef.current));
  }, []);

  const popover = usePopover({
    ...rest,
    open,
    modal: false,
    portalled: true,
    positioning: layerPositioning({ overflowPadding: 8, fitViewport: true, ...positioning }),
    initialFocusEl,
    finalFocusEl: resolveReturnTarget,
    onOpenChange: (details) => {
      if (details.open === open || (details.open && disabled)) return;
      onOpenChange(details);
    },
    onEscapeKeyDown: (event) => {
      if (isComposingKey(event)) event.preventDefault();
      else onEscapeKeyDown?.(event);
    },
  });

  const bindContent = useCallback((content: HTMLDivElement | null) => {
    contentRef.current = content;
    if (content) registerPopoverReturnTarget(content, previousFocus);
  }, []);

  useLayoutEffect(() => {
    popoverRef.current = popover;
  });
  const getAnchor = () => findAnchor(popover);

  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      previousFocus.current = resolveFocusReturnTarget(document.activeElement);
    }
    wasOpen.current = open;
  }, [open]);

  const close = () => onOpenChange({ open: false });
  useCloseOnAnchorScroll(open, getAnchor, close);
  useCloseOnParentExit(closeOnParentExit, open, close);
  const lifetime = usePresenceLifetime(popover.open);

  return {
    open,
    closeAndReturn() {
      if (!open) return;
      resolveReturnTarget()?.focus({ preventScroll: true });
      onOpenChange({ open: false });
    },
    focusInitial() {
      const target = initialFocusEl?.();
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    },
    [INTERNALS]: {
      popover,
      ...lifetime,
      getAnchor,
      bindContent,
      triggerProps: disabledTriggerProps(disabled, POPOVER_OPEN_KEYS),
    },
  };
}

const HandleContext = createContext<MotionPopoverHandle | null>(null);

function usePopoverInternals(): PopoverInternals {
  const handle = useContext(HandleContext);
  if (!handle) throw new Error("ポップオーバーの部品は MotionPopoverRoot の中に置く");
  return handle[INTERNALS];
}

export function MotionPopoverRoot({
  handle,
  children,
}: {
  handle: MotionPopoverHandle;
  children: ReactNode;
}) {
  const { popover, present } = handle[INTERNALS];
  return (
    <Popover.RootProvider value={popover} present={present}>
      <HandleContext.Provider value={handle}>{children}</HandleContext.Provider>
    </Popover.RootProvider>
  );
}

/** Popover.Trigger asChild に、disabled の処理を合わせる */
export function MotionPopoverTrigger({ children }: { children: ReactElement }) {
  const { triggerProps } = usePopoverInternals();
  return (
    <Popover.Trigger asChild {...triggerProps}>
      {children}
    </Popover.Trigger>
  );
}

type PopoverPopupProps = Omit<
  ComponentPropsWithRef<typeof motion.div>,
  "inert" | "onKeyDownCapture"
>;

function Popup({
  container,
  bindContent,
  className,
  children,
  ...rest
}: PopoverPopupProps & {
  container: HTMLElement | null;
  bindContent: PopoverInternals["bindContent"];
}) {
  const isPresent = useIsPresent();
  const { layerScale } = useMotionVariants();
  const containerRef = useRef(container);
  return (
    <Portal container={containerRef}>
      <Popover.Positioner>
        <Popover.Content asChild ref={bindContent}>
          <motion.div
            {...rest}
            {...layerScale()}
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
  const { popover, onExitComplete, getAnchor, bindContent } = usePopoverInternals();
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {popover.open && (
        <Popup
          key="popup"
          container={layerContainer(getAnchor())}
          bindContent={bindContent}
          {...props}
        />
      )}
    </AnimatePresence>
  );
}
