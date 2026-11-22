import { useEffect, useRef, type RefObject } from "react";

/**
 * 没入モード中、アプリシェル（TopBar/AddressBar/サイドバー。`.mle-frame` 直下のうち
 * main を除く要素）を inert にし、フォーカスを切替ボタンへ移す。解除すると元の位置へ戻す。
 * Esc は再生中の層が受けて層ごと閉じるので、没入の切り替えはボタンだけが持つ。
 */
export function useNowPlayingImmersiveShell(
  active: boolean,
  focusTarget: RefObject<HTMLElement | null>,
) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const shellSiblings = Array.from(
      document.querySelectorAll<HTMLElement>(".mle-frame > :not(main)"),
    );
    const wasInert = shellSiblings.map((el) => el.hasAttribute("inert"));
    for (const el of shellSiblings) el.setAttribute("inert", "");

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusTarget.current?.focus({ preventScroll: true });

    return () => {
      shellSiblings.forEach((el, i) => {
        if (!wasInert[i]) el.removeAttribute("inert");
      });
      // 没入前のフォーカス元（カバー等）は通常表示側の AnimatePresence 境界ごと
      // アンマウントされていることがある。その場合は通常表示に必ず存在する
      // 切替アイコン（.mle-nowplaying__mode-toggle）へフォールバックする。
      const restoreTarget = previousFocusRef.current?.isConnected
        ? previousFocusRef.current
        : document.querySelector<HTMLElement>(".mle-nowplaying__mode-toggle");
      restoreTarget?.focus({ preventScroll: true });
    };
  }, [active, focusTarget]);
}
