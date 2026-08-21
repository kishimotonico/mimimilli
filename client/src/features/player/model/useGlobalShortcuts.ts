import { useEffect, useRef, useCallback } from "react";

/** ネイティブ操作を優先し、グローバルショートカットの対象から外す要素。 */
const SHORTCUT_EXEMPT_SELECTOR = 'button, a, input, textarea, select, [role="slider"], [contenteditable]';

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
