import { useEffect, useRef, useCallback } from "react";

/** ネイティブ操作を優先し、常に（全キー）グローバルショートカットの対象から外す要素。 */
const SHORTCUT_EXEMPT_SELECTOR = "button, a, input, textarea, select, [contenteditable]";

/** カスタムスライダー（シーク行・ABハンドル）が自前で処理するキー。Spaceにはスライダー
 *  側のネイティブ動作がないため対象外にせず、従来どおりグローバル側で処理する。 */
const SLIDER_SELECTOR = '[role="slider"]';
const SLIDER_OWNED_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

interface UseGlobalShortcutsOptions {
  /** Space キーで再生/一時停止。isActive が false の場合は何もしない。 */
  onTogglePlay: () => void;
  /** ← / → キーで ±10秒シーク。isActive が false の場合は何もしない。 */
  onSeekRelative: (deltaSec: number) => void;
  /** 再生対象（currentWork）が存在するか（各ショートカットの有効化条件） */
  isActive: boolean;
}

export function useGlobalShortcuts({
  onTogglePlay,
  onSeekRelative,
  isActive,
}: UseGlobalShortcutsOptions) {
  const onTogglePlayRef = useRef(onTogglePlay);
  const onSeekRelativeRef = useRef(onSeekRelative);
  const isActiveRef = useRef(isActive);
  onTogglePlayRef.current = onTogglePlay;
  onSeekRelativeRef.current = onSeekRelative;
  isActiveRef.current = isActive;

  const handler = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest?.(SHORTCUT_EXEMPT_SELECTOR)) return;
    if (SLIDER_OWNED_KEYS.has(e.code) && target.closest?.(SLIDER_SELECTOR)) return;
    if (!isActiveRef.current) return;

    if (e.code === "Space") {
      e.preventDefault();
      onTogglePlayRef.current();
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      onSeekRelativeRef.current(-10);
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      onSeekRelativeRef.current(10);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
