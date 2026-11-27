import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Menu, useMenu, type UseMenuProps, type UseMenuReturn } from "@ark-ui/react/menu";
import { Portal } from "@ark-ui/react/portal";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { findLayerTrigger, layerContainer, MENU_TRIGGER_SELECTOR } from "../layer/layerDom";
import { layerPositioning } from "../layer/layerPositioning";
import { ignoreComposingKey, isComposingKey } from "../layer/keys";
import { disabledTriggerProps, MENU_OPEN_KEYS } from "../layer/layerTrigger";
import { useCloseOnAnchorScroll } from "../layer/useCloseOnAnchorScroll";
import { useCloseOnParentExit } from "../layer/useCloseOnParentExit";
import { usePresenceLifetime } from "../layer/usePresenceLifetime";
import { useMotionVariants } from "../useMotionVariants";
import { menuPanelClass } from "./menuStyles";

interface MotionMenuProps extends UseMenuProps {
  /** ラジオを持つメニューの現在値。キーボードで開いたとき、先頭ではなくこの項目をハイライトする */
  initialHighlight?: string | null;
  /** 無効。フォーカスを残したまま、開く操作（ポインター・キーボード）を受けなくする */
  disabled?: boolean;
  /** 親が AnimatePresence で退出に入ったら閉じる */
  closeOnParentExit?: boolean;
  /** 閉じているときの開く操作（ポインター・Enter・Space・ArrowDown・ArrowUp）で呼ぶ。true を返すと開かない */
  interceptOpen?: () => boolean;
}

const INTERNALS = Symbol("motionMenuInternals");

interface MenuInternals {
  menu: UseMenuReturn;
  present: boolean;
  onExitComplete: () => void;
  triggerProps: HTMLAttributes<HTMLElement>;
  closeWithoutRestoringFocus: () => void;
}

export interface MotionMenuHandle {
  open: boolean;
  /** フォーカスをトリガーへ戻して閉じる */
  closeAndReturn: () => void;
  readonly [INTERNALS]: MenuInternals;
}

export function useMotionMenu(props: MotionMenuProps = {}): MotionMenuHandle {
  const {
    onEscapeKeyDown,
    onInteractOutside,
    onPointerDownOutside,
    onHighlightChange,
    initialHighlight,
    onOpenChange,
    disabled = false,
    closeOnParentExit = false,
    interceptOpen,
    positioning,
    ...rest
  } = props;
  const keyboardOpenPending = useRef(false);
  const menuRef = useRef<UseMenuReturn | null>(null);
  const menu = useMenu({
    loopFocus: true,
    ...rest,
    positioning: layerPositioning(positioning),
    onOpenChange: (details) => {
      onOpenChange?.(details);
      if (!details.open) keyboardOpenPending.current = false;
    },
    onHighlightChange: (details) => {
      onHighlightChange?.(details);
      // キーボードで開くと Ark UI が先頭（または末尾）を選ぶ。その最初の1回だけ現在値へ置き換える
      if (!keyboardOpenPending.current || details.highlightedValue === null) return;
      keyboardOpenPending.current = false;
      if (initialHighlight != null && details.highlightedValue !== initialHighlight) {
        menuRef.current?.api.setHighlightedValue(initialHighlight);
      }
    },
    onInteractOutside: (event) => {
      onInteractOutside?.(event);
      // defaultPrevented は zag のツリー判定（サブメニュー・右クリックのトリガー）の結果
      if (event.defaultPrevented) return;
      if (event.detail.originalEvent.type !== "focusin") return;
      // 外へ移ったフォーカス（プログラムの focus()、別のメニューのトリガー）をトリガーへ奪い返さず、そのまま閉じる。
      // CLOSE の restoreFocus: false は zag の内部仕様（Ark UI 5.40.0 固定に依存）
      event.preventDefault();
      menuRef.current?.service.send({ type: "CLOSE", restoreFocus: false });
    },
    onPointerDownOutside: (event) => {
      onPointerDownOutside?.(event);
      // 別のメニューのトリガーは、押してもフォーカスを受けない（Ark UI が pointerdown を止める）。
      // このメニューが閉じて中身が消えるときに body へ落ちないよう、先にそのトリガーへ移す
      const target = event.detail.originalEvent.target;
      const trigger = target instanceof Element ? target.closest(MENU_TRIGGER_SELECTOR) : null;
      if (trigger instanceof HTMLElement) trigger.focus({ preventScroll: true });
    },
    onEscapeKeyDown: (event) => {
      // IME の変換中の Esc は、変換の取消に使われるので閉じない
      if (isComposingKey(event)) event.preventDefault();
      else onEscapeKeyDown?.(event);
    },
  });
  useLayoutEffect(() => {
    menuRef.current = menu;
  });
  const { open } = menu.api;
  const lifetime = usePresenceLifetime(open);

  const closeAndReturn = useCallback(() => menuRef.current?.api.setOpen(false), []);
  const closeWithoutRestoringFocus = useCallback(
    () => menuRef.current?.service.send({ type: "CLOSE", restoreFocus: false }),
    [],
  );
  const contentId = menu.api.getContentProps().id ?? "";
  const getAnchor = useCallback(() => findLayerTrigger(contentId), [contentId]);
  useCloseOnAnchorScroll(open, getAnchor, closeAndReturn);
  useCloseOnParentExit(closeOnParentExit, open, closeAndReturn);

  const triggerProps = {
    ...(interceptOpen && {
      onKeyDownCapture: (event: ReactKeyboardEvent) => {
        if (!open && MENU_OPEN_KEYS.has(event.key) && interceptOpen()) event.preventDefault();
      },
      onClickCapture: (event: ReactMouseEvent) => {
        if (open || !interceptOpen()) return;
        event.preventDefault();
        event.stopPropagation();
      },
    }),
    ...disabledTriggerProps(disabled, MENU_OPEN_KEYS),
    // キーボードで開いたかどうかを覚える
    onKeyDown: (event: ReactKeyboardEvent) => {
      keyboardOpenPending.current =
        !event.defaultPrevented && !open && MENU_OPEN_KEYS.has(event.key);
    },
    onPointerDown: () => {
      keyboardOpenPending.current = false;
    },
  };

  return {
    open,
    closeAndReturn,
    [INTERNALS]: { menu, ...lifetime, triggerProps, closeWithoutRestoringFocus },
  };
}

const HandleContext = createContext<MotionMenuHandle | null>(null);

function useMenuInternals(): MenuInternals {
  const handle = useContext(HandleContext);
  if (!handle) throw new Error("メニューの部品は MotionMenuRoot の中に置く");
  return handle[INTERNALS];
}

/** フォーカスをトリガーへ戻さずにメニューを閉じる。別の層を開く項目（MenuLayerItem）が使う */
export function useCloseMenuWithoutRestoringFocus(): () => void {
  return useMenuInternals().closeWithoutRestoringFocus;
}

/** Menu.RootProvider の代わり。退出アニメーションの間、Ark UI の寿命を延ばす */
export function MotionMenuRoot({
  handle,
  children,
}: {
  handle: MotionMenuHandle;
  children: ReactNode;
}) {
  const { menu, present } = handle[INTERNALS];
  return (
    <Menu.RootProvider value={menu} present={present}>
      <HandleContext.Provider value={handle}>{children}</HandleContext.Provider>
    </Menu.RootProvider>
  );
}

/** Menu.Trigger asChild に、開閉キーの記録と disabled の処理を合わせる */
export function MotionMenuTrigger({ children }: { children: ReactElement }) {
  const { triggerProps } = useMenuInternals();
  return (
    <Menu.Trigger asChild {...triggerProps}>
      {children}
    </Menu.Trigger>
  );
}

interface MenuPopupProps {
  narrow?: boolean;
  "aria-label"?: string;
  children: ReactNode;
}

/** AnimatePresence の直接の子。退出中は inert にして、中身を操作できないようにする */
function Popup({
  container,
  narrow,
  children,
  ...rest
}: MenuPopupProps & { container: HTMLElement | null }) {
  const isPresent = useIsPresent();
  const { layerScale } = useMotionVariants();
  const containerRef = useRef(container);
  return (
    <Portal container={containerRef}>
      <Menu.Positioner>
        <Menu.Content asChild>
          <motion.div
            {...layerScale()}
            {...rest}
            onKeyDownCapture={ignoreComposingKey}
            inert={!isPresent}
            className={menuPanelClass({ narrow })}
          >
            {children}
          </motion.div>
        </Menu.Content>
      </Menu.Positioner>
    </Portal>
  );
}

/** MotionMenuRoot の中に置く。開閉は Ark UI の状態、出入りの表示は AnimatePresence */
export function MenuPopup(props: MenuPopupProps) {
  const { menu, onExitComplete } = useMenuInternals();
  const { api } = menu;
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {api.open && (
        <Popup
          key="popup"
          container={layerContainer(findLayerTrigger(api.getContentProps().id ?? ""))}
          {...props}
        />
      )}
    </AnimatePresence>
  );
}
