import { useEffect, useRef, type RefObject } from "react";

/**
 * 没入モード中、アプリシェル（TopBar/AddressBar/LeftNav。`.mle-frame` 直下のうち
 * main を除く要素）を inert にし、Escape で解除する。トップレベルの <dialog> が
 * 開いている間（旧全画面プレイヤー等）は Escape を消費させない。
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
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [active, focusTarget]);
}
