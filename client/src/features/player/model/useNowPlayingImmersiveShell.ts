import { useEffect, useRef, type RefObject } from "react";

/**
 * 没入モード中、アプリシェル（TopBar/AddressBar/LeftNav。`.mle-frame` 直下のうち
 * main を除く要素）を inert にし、Escape で解除する。設定・スキャン等のモーダルを開く
 * トリガーは inert 化された領域にしかないためクリック経路では同時発生しないが、
 * ブラウザの戻る/進む（popstate）はUIのinertを経由せず appMode を直接書き換えるため、
 * モーダルを開いたまま保存モードが没入の /now-playing へ履歴遷移できてしまう。
 * その状態でモーダルを閉じずに Escape を押すと「最前面の dialog だけが Esc を消費する」
 * 規則が破られる（このハンドラの preventDefault が dialog の cancel をブロックし、
 * 没入だけが誤って解除される）ため、:modal が存在する間は消費しない。
 */
export function useNowPlayingImmersiveShell(
  active: boolean,
  onExit: () => void,
  focusTarget: RefObject<HTMLElement | null>,
) {
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const shellSiblings = Array.from(
      document.querySelectorAll<HTMLElement>(".mle-frame > :not(main)"),
    );
    for (const el of shellSiblings) el.setAttribute("inert", "");

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusTarget.current?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(":modal")) return;
      e.preventDefault();
      onExitRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      for (const el of shellSiblings) el.removeAttribute("inert");
      document.removeEventListener("keydown", handleKeyDown);
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
