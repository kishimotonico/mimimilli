import { useLayoutEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, RefObject, SyntheticEvent } from "react";
import { useSetAtom } from "jotai";
import { openModalDialogsAtom } from "../model/openModalDialogsAtom";
import { getTabbableElements } from "./focusable";
import { resolveFocusReturnTarget } from "./layer/focusReturnTarget";
import { MENU_CONTENT_SELECTOR, OPEN_LAYER_SELECTOR } from "./layer/layerDom";

interface UseDialogModalOptions {
  /**
   * モーダルを閉じる（または内側の編集を先にキャンセルする）処理。
   * Escape・×・背景クリックはすべてここに委譲する。
   */
  onClose: () => void;
  /** マウント時にフォーカスする要素。省略時は dialog 自身にフォーカスする。 */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * ネイティブ <dialog> + showModal() を薄くラップする共通フック。
 * 「多重モーダル時は最前面のEscだけが効く」挙動はブラウザの top layer 実装に任せる。
 * フォーカストラップはネイティブ実装に加え、末尾/先頭でのTab循環を手動でも補完する
 * （編集モーダル末尾からのTabでBODYへフォーカスが落ちる欠陥があったため）。
 */
export function useDialogModal({ onClose, initialFocusRef }: UseDialogModalOptions) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const setOpenDialogs = useSetAtom(openModalDialogsAtom);
  const pressedBackdropWithLayerOpen = useRef(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousActiveElement = resolveFocusReturnTarget(document.activeElement);

    dialog.showModal();
    (initialFocusRef?.current ?? dialog).focus({ preventScroll: true });
    // 開いた順（末尾が最前面）で積む。useTopmostOpenModalDialog はこのスタックの末尾を読む
    setOpenDialogs((current) => [...current, dialog]);

    // ネイティブのフォーカストラップに加えて手動で補完する（Tab循環を保険として持つ）。
    // dialog直下の要素（fixed配置のToastなど）も含めて対象にするため querySelector で毎回集める。
    const handleTabKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      // dialog の中へポータルされたメニューの Tab は、メニュー（Ark UI）が開いたまま止める
      if (event.target instanceof Element && event.target.closest(MENU_CONTENT_SELECTOR)) return;
      const focusable = getTabbableElements(dialog);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const isInsideDialog = dialog.contains(document.activeElement);
      if (event.shiftKey) {
        if (!isInsideDialog || document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!isInsideDialog || document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", handleTabKeyDown);

    // Ark UI の層は、マウスでは pointerdown の次フレーム、タッチでは click で閉じる。
    // click の時点では開いていたか分からないので、押した時点で開いていたかを覚える
    const handlePointerDown = (event: PointerEvent) => {
      pressedBackdropWithLayerOpen.current =
        event.target === dialog && dialog.querySelector(OPEN_LAYER_SELECTOR) !== null;
    };
    dialog.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      dialog.removeEventListener("keydown", handleTabKeyDown);
      dialog.removeEventListener("pointerdown", handlePointerDown, true);
      dialog.close();
      setOpenDialogs((current) => current.filter((entry) => entry !== dialog));
      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus({ preventScroll: true });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 開閉は一度きりのライフサイクルとして扱う
  }, []);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    // ブラウザ既定のクローズ動作を止め、呼び出し側の onClose に委譲する。
    event.preventDefault();
    // ネイティブのcancelは最前面のdialogにしか発火しないが、Reactの合成イベントは
    // Reactツリーを伝播するため、ポータルで重ねた親dialogのonCancelにも届いてしまう。
    // 多重モーダルで最前面だけを閉じるため、ここで伝播を止める。
    event.stopPropagation();
    onClose();
  };

  /**
   * <dialog> のbackdropクリックは e.target === dialog自身として届く
   * （dialog は幅がcontentにfitするため、backdrop領域のクリックはdialog要素にヒットする）。
   * shouldClose で保存中などの条件を差し込める（省略時は常に閉じる）。
   * 層を開いたまま押した backdrop は、層だけを閉じて dialog は閉じない。
   */
  const handleBackdropClick = (
    event: ReactMouseEvent<HTMLDialogElement>,
    shouldClose: () => boolean = () => true,
  ) => {
    if (event.target !== dialogRef.current) return;
    if (pressedBackdropWithLayerOpen.current) {
      pressedBackdropWithLayerOpen.current = false;
      return;
    }
    if (shouldClose()) onClose();
  };

  return { dialogRef, handleCancel, handleBackdropClick };
}
