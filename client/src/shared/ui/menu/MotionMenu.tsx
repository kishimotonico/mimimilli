import {
  createContext,
  useContext,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Menu, useMenu, type UseMenuProps, type UseMenuReturn } from "@ark-ui/react/menu";
import { Portal } from "@ark-ui/react/portal";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useMotionVariants } from "../useMotionVariants";
import { menuPanelClass } from "./menuStyles";
import { usePresenceLifetime } from "./usePresenceLifetime";

const ExitCompleteContext = createContext<(() => void) | null>(null);

function isComposingKey(event: KeyboardEvent | ReactKeyboardEvent): boolean {
  const native = "nativeEvent" in event ? event.nativeEvent : event;
  return native.isComposing || native.keyCode === 229;
}

/** フォーカスの移動先が、メニューの中身か右クリックのトリガーか */
export function isInsideMenuTree(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      '[data-scope="menu"][data-part="content"], [data-scope="menu"][data-part="context-trigger"]',
    ) !== null
  );
}

const KEYBOARD_OPEN_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", " "]);

interface MotionMenuProps extends UseMenuProps {
  /** ラジオを持つメニューの現在値。キーボードで開いたとき、先頭ではなくこの項目をハイライトする */
  initialHighlight?: string | null;
  /** 無効。トリガーに triggerProps を展開すると、開く操作（ポインター・キーボード）を受けなくなる */
  disabled?: boolean;
}

export function useMotionMenu(props: MotionMenuProps = {}) {
  const {
    onEscapeKeyDown,
    onFocusOutside,
    onHighlightChange,
    initialHighlight,
    onOpenChange,
    disabled = false,
    positioning,
    ...rest
  } = props;
  const apiRef = useRef<UseMenuReturn["api"] | null>(null);
  const serviceRef = useRef<UseMenuReturn["service"] | null>(null);
  const keyboardOpenPending = useRef(false);
  const menu = useMenu({
    loopFocus: true,
    ...rest,
    // fixed はダイアログの overflow に切り取られない。アンカーがスクロールで見えなくなったらメニューも隠す
    positioning: { strategy: "fixed", hideWhenDetached: true, ...positioning },
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
        apiRef.current?.setHighlightedValue(initialHighlight);
      }
    },
    onFocusOutside: (event) => {
      onFocusOutside?.(event);
      if (event.defaultPrevented) return;
      // メニューツリー（サブメニュー・右クリックのトリガー）への移動は、zag の除外判定に任せる
      if (isInsideMenuTree(event.detail.originalEvent.target)) return;
      // 外へ移ったフォーカス（プログラムの focus()）をトリガーへ奪い返さず、そのまま閉じる。
      // CLOSE の restoreFocus: false は zag の内部仕様（Ark UI 5.40.0 固定に依存）
      event.preventDefault();
      serviceRef.current?.send({ type: "CLOSE", restoreFocus: false });
    },
    onEscapeKeyDown: (event) => {
      // IME の変換中の Esc は、変換の取消に使われるので閉じない
      if (isComposingKey(event)) event.preventDefault();
      else onEscapeKeyDown?.(event);
    },
  });
  apiRef.current = menu.api;
  serviceRef.current = menu.service;
  const lifetime = usePresenceLifetime(menu.api.open);
  /** トリガーへ展開する。キーボードで開いたかどうかを覚え、disabled のときは開かせない */
  const triggerProps = {
    // data-disabled は Ark UI がポインター操作を無視する印。キーボードは defaultPrevented を見る
    "data-disabled": disabled ? "" : undefined,
    onKeyDownCapture: (event: ReactKeyboardEvent) => {
      if (disabled) event.preventDefault();
    },
    onKeyDown: (event: ReactKeyboardEvent) => {
      keyboardOpenPending.current = !menu.api.open && KEYBOARD_OPEN_KEYS.has(event.key);
    },
    onPointerDown: () => {
      keyboardOpenPending.current = false;
    },
  };
  return { menu, triggerProps, ...lifetime };
}

export type MotionMenuHandle = ReturnType<typeof useMotionMenu>;

/** Menu.RootProvider の代わり。退出アニメーションの間、Ark UI の寿命を延ばす */
export function MotionMenuRoot({
  handle,
  children,
}: {
  handle: MotionMenuHandle;
  children: ReactNode;
}) {
  return (
    <Menu.RootProvider value={handle.menu} present={handle.present}>
      <ExitCompleteContext.Provider value={handle.onExitComplete}>
        {children}
      </ExitCompleteContext.Provider>
    </Menu.RootProvider>
  );
}

interface MenuPopupProps {
  /** 出現の起点（transform-origin）。開く向きに合わせる */
  origin: string;
  narrow?: boolean;
  "aria-label"?: string;
  children: ReactNode;
}

/** IME の変換中のキーは、項目の実行にも移動にも使わない */
function ignoreComposingKey(event: ReactKeyboardEvent) {
  if (isComposingKey(event)) event.stopPropagation();
}

/** AnimatePresence の直接の子。退出中は inert にして、中身を操作できないようにする */
function Popup({
  container,
  origin,
  narrow,
  children,
  ...rest
}: MenuPopupProps & { container: RefObject<HTMLElement | null> }) {
  const isPresent = useIsPresent();
  const { menuScale } = useMotionVariants();
  return (
    <Portal container={container}>
      <Menu.Positioner>
        <Menu.Content asChild>
          <motion.div
            {...menuScale({ origin })}
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

/** ネイティブ dialog の中のトリガーから開いたメニューは、その dialog の中へ出す（top layer の外では見えないため） */
function dialogOf(api: UseMenuReturn["api"]): HTMLDialogElement | null {
  const trigger = document.querySelector(
    `[aria-controls="${CSS.escape(api.getContentProps().id ?? "")}"]`,
  );
  return trigger?.closest("dialog") ?? null;
}

/** MotionMenuRoot の中に置く。開閉は Ark UI の状態、出入りの表示は AnimatePresence */
export function MenuPopup(props: MenuPopupProps) {
  const onExitComplete = useContext(ExitCompleteContext);
  return (
    <Menu.Context>
      {(api) => (
        <AnimatePresence onExitComplete={onExitComplete ?? undefined}>
          {api.open && <Popup key="popup" container={{ current: dialogOf(api) }} {...props} />}
        </AnimatePresence>
      )}
    </Menu.Context>
  );
}
