import {
  createContext,
  useContext,
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Menu, useMenu, type UseMenuProps, type UseMenuReturn } from "@ark-ui/react/menu";
import { Portal } from "@ark-ui/react/portal";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { ignoreComposingKey, isComposingKey } from "../layer/keys";
import { layerContainer } from "../layer/layerContainer";
import { useCloseOnAnchorScroll } from "../layer/useCloseOnAnchorScroll";
import { usePresenceLifetime } from "../layer/usePresenceLifetime";
import { useMotionVariants } from "../useMotionVariants";
import { menuPanelClass } from "./menuStyles";

const ExitCompleteContext = createContext<(() => void) | null>(null);
/** フォーカスをトリガーへ戻さずにメニューを閉じる。別の層を開く項目（MenuLayerItem）が使う */
export const CloseWithoutRestoreContext = createContext<(() => void) | null>(null);

function getMenuTrigger(contentId: string): Element | null {
  return document.querySelector(`[aria-controls="${CSS.escape(contentId)}"]`);
}

/**
 * フォーカスの移動先が、このメニューのツリー（自分の中身から開いたサブメニュー、自分の右クリックのトリガー）か。
 * 別のメニューは含めない。別のメニューへの移動は外へ移ったものとして扱う
 */
export function isInsideOwnMenuTree(
  target: EventTarget | null,
  contentId: string,
  contextTriggerId: string | undefined,
): boolean {
  if (!(target instanceof Element)) return false;
  const own = document.getElementById(contentId);
  // 移動先の中身のトリガーから親の中身へたどり、自分の中身に着くか（孫のサブメニューを含む）
  let content = target.closest('[data-scope="menu"][data-part="content"]');
  while (content) {
    if (content === own) return true;
    const triggerId = content.getAttribute("aria-labelledby");
    const trigger = triggerId ? document.getElementById(triggerId) : null;
    if (!trigger) return false;
    if (own?.contains(trigger)) return true;
    content = trigger.closest('[data-scope="menu"][data-part="content"]');
  }
  const contextTrigger = target.closest('[data-scope="menu"][data-part="context-trigger"]');
  return contextTrigger !== null && contextTrigger.id === contextTriggerId;
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
    onPointerDownOutside,
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
    // fixed はダイアログの overflow に切り取られない
    positioning: { strategy: "fixed", ...positioning },
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
      const api = apiRef.current;
      if (
        api &&
        isInsideOwnMenuTree(
          event.detail.originalEvent.target,
          api.getContentProps().id ?? "",
          api.getContextTriggerProps().id,
        )
      ) {
        return;
      }
      // 外へ移ったフォーカス（プログラムの focus()、別のメニューのトリガー）をトリガーへ奪い返さず、そのまま閉じる。
      // CLOSE の restoreFocus: false は zag の内部仕様（Ark UI 5.40.0 固定に依存）
      event.preventDefault();
      serviceRef.current?.send({ type: "CLOSE", restoreFocus: false });
    },
    onPointerDownOutside: (event) => {
      onPointerDownOutside?.(event);
      // 別のメニューのトリガーは、押してもフォーカスを受けない（Ark UI が pointerdown を止める）。
      // このメニューが閉じて中身が消えるときに body へ落ちないよう、先にそのトリガーへ移す
      const target = event.detail.originalEvent.target;
      const trigger =
        target instanceof Element
          ? target.closest('[data-scope="menu"][data-part="trigger"]')
          : null;
      if (trigger instanceof HTMLElement) trigger.focus({ preventScroll: true });
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

  // スクロールで閉じるときもフォーカスはトリガーへ戻す
  const contentId = menu.api.getContentProps().id ?? "";
  const getAnchor = useCallback(() => getMenuTrigger(contentId), [contentId]);
  const closeOnScroll = useCallback(() => serviceRef.current?.send({ type: "CLOSE" }), []);
  useCloseOnAnchorScroll(menu.api.open, getAnchor, closeOnScroll);

  /** トリガーへ展開する。キーボードで開いたかどうかを覚え、disabled のときは開かせない */
  const triggerProps = {
    // data-disabled は Ark UI がポインター操作を無視する印。キーボードは defaultPrevented を見る
    "data-disabled": disabled ? "" : undefined,
    onKeyDownCapture: (event: ReactKeyboardEvent) => {
      // 開くキーだけを止める。Tab や Esc は通す
      if (disabled && KEYBOARD_OPEN_KEYS.has(event.key)) event.preventDefault();
    },
    onKeyDown: (event: ReactKeyboardEvent) => {
      keyboardOpenPending.current = !menu.api.open && KEYBOARD_OPEN_KEYS.has(event.key);
    },
    onPointerDown: () => {
      keyboardOpenPending.current = false;
    },
  };
  const closeWithoutRestoringFocus = () =>
    serviceRef.current?.send({ type: "CLOSE", restoreFocus: false });
  return { menu, triggerProps, closeWithoutRestoringFocus, ...lifetime };
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
        <CloseWithoutRestoreContext.Provider value={handle.closeWithoutRestoringFocus}>
          {children}
        </CloseWithoutRestoreContext.Provider>
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

/** MotionMenuRoot の中に置く。開閉は Ark UI の状態、出入りの表示は AnimatePresence */
export function MenuPopup(props: MenuPopupProps) {
  const onExitComplete = useContext(ExitCompleteContext);
  return (
    <Menu.Context>
      {(api) => (
        <AnimatePresence onExitComplete={onExitComplete ?? undefined}>
          {api.open && (
            <Popup
              key="popup"
              container={{
                current: layerContainer(getMenuTrigger(api.getContentProps().id ?? "")),
              }}
              {...props}
            />
          )}
        </AnimatePresence>
      )}
    </Menu.Context>
  );
}
