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

const KEYBOARD_OPEN_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", " "]);

interface MotionMenuProps extends UseMenuProps {
  /** ラジオを持つメニューの現在値。キーボードで開いたとき、先頭ではなくこの項目をハイライトする */
  initialHighlight?: string | null;
}

export function useMotionMenu(props: MotionMenuProps = {}) {
  const { onEscapeKeyDown, onFocusOutside, onHighlightChange, initialHighlight, ...rest } = props;
  const apiRef = useRef<UseMenuReturn["api"] | null>(null);
  const keyboardOpenPending = useRef(false);
  const menu = useMenu({
    loopFocus: true,
    ...rest,
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
      // 外へ移ったフォーカス（Tab やプログラムの focus()）をトリガーへ奪い返さない。
      // Ark UI の閉じ方はトリガーへ戻すので、閉じた後に移動先へ戻す
      const target = event.detail.originalEvent.target;
      event.preventDefault();
      apiRef.current?.setOpen(false);
      setTimeout(() => {
        if (target instanceof HTMLElement && target.isConnected) {
          target.focus({ preventScroll: true });
        }
      }, 0);
    },
    onEscapeKeyDown: (event) => {
      // IME の変換中の Esc は、変換の取消に使われるので閉じない
      if (isComposingKey(event)) event.preventDefault();
      else onEscapeKeyDown?.(event);
    },
  });
  apiRef.current = menu.api;
  const lifetime = usePresenceLifetime(menu.api.open);
  /** トリガーへ展開する。キーボードで開いたかどうかを覚える */
  const triggerProps = {
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
  /** ネイティブ dialog の中のメニューは、その dialog を渡す */
  container?: RefObject<HTMLElement | null>;
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
function Popup({ container, origin, narrow, children, ...rest }: MenuPopupProps) {
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

/** MotionMenuRoot の中に置く。開閉は Ark UI の状態、出入りの表示は AnimatePresence */
export function MenuPopup(props: MenuPopupProps) {
  const onExitComplete = useContext(ExitCompleteContext);
  return (
    <Menu.Context>
      {(api) => (
        <AnimatePresence onExitComplete={onExitComplete ?? undefined}>
          {api.open && <Popup key="popup" {...props} />}
        </AnimatePresence>
      )}
    </Menu.Context>
  );
}
