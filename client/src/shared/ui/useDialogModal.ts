import { useLayoutEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, RefObject, SyntheticEvent } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseDialogModalOptions {
  /**
   * Escape（dialogのcancelイベント）で呼ぶ処理。編集中フォームがあればそちらだけを
   * 閉じるなど、内側の状態を優先する分岐はここに書く（例: SettingsModal）。
   * backdropクリックの挙動は各モーダルの現状維持のため handleBackdropClick に別途渡す。
   */
  onClose: () => void;
  /** マウント時にフォーカスする要素。省略時は dialog 自身にフォーカスする。 */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * ネイティブ <dialog> + showModal() を薄くラップする共通フック（TASK-29）。
 * 「多重モーダル時は最前面のEscだけが効く」挙動はブラウザの top layer 実装に任せる。
 * フォーカストラップはネイティブ実装に加え、末尾/先頭でのTab循環を手動でも補完する
 * （編集モーダル末尾からのTabでBODYへフォーカスが落ちる欠陥があったため）。
 */
export function useDialogModal({ onClose, initialFocusRef }: UseDialogModalOptions) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    dialog.showModal();
    (initialFocusRef?.current ?? dialog).focus({ preventScroll: true });

    // ネイティブのフォーカストラップに加えて手動で補完する（Tab循環を保険として持つ）。
    // dialog直下の要素（fixed配置のToastなど）も含めて対象にするため querySelector で毎回集める。
    const handleTabKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
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

    return () => {
      dialog.removeEventListener("keydown", handleTabKeyDown);
      dialog.close();
      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus({ preventScroll: true });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 開閉は一度きりのライフサイクルとして扱う
  }, []);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    // ブラウザ既定のクローズ動作を止め、呼び出し側の onClose に委譲する
    // （呼び出し側は内側の編集状態を先に閉じる分岐を持てる）。
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
   * onBackdropClose は呼び出し側のEscape分岐（onClose）と揃えるとは限らないため、
   * 各モーダルの既存backdrop挙動をそのまま渡す（例: SettingsModalは編集中でも問答無用で閉じる）。
   * shouldClose で保存中などの条件を差し込める。
   */
  const handleBackdropClick = (
    event: ReactMouseEvent<HTMLDialogElement>,
    onBackdropClose: () => void,
    shouldClose: () => boolean = () => true,
  ) => {
    if (event.target === dialogRef.current && shouldClose()) onBackdropClose();
  };

  return { dialogRef, handleCancel, handleBackdropClick };
}
