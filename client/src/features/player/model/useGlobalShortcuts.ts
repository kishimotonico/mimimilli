import { useEffect, useRef, useCallback } from "react";

/** ネイティブ操作を優先し、常に（全キー）グローバルショートカットの対象から外す要素。 */
const SHORTCUT_EXEMPT_SELECTOR =
  'input, textarea, select, [contenteditable], [role="menu"], [role="listbox"], button, a';

/** 再生/一時停止・前後トラック・±10秒・ループ・速度・音量トリガーなど、常設プレイヤーの
 *  操作ボタン。Space はここにフォーカスがあっても常にグローバルの再生/一時停止として扱う
 *  （Web標準のボタン活性化に任せると、ボタンごとに別々の意味でSpaceが反応してしまうため）。 */
const PLAYER_CONTROL_SELECTOR = "[data-player-control]";

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
    // モーダルdialogが開いている間は、フォーカス位置に関わらず背後の再生を操作しない。
    if (document.querySelector("dialog[open]")) return;

    const target = e.target as HTMLElement;
    // Spaceに限り、プレイヤー操作ボタン自身の活性化より常にグローバルの再生/一時停止を優先する。
    const isPlayerControlSpace = e.code === "Space" && !!target.closest?.(PLAYER_CONTROL_SELECTOR);
    if (!isPlayerControlSpace && target.closest?.(SHORTCUT_EXEMPT_SELECTOR)) return;
    if (SLIDER_OWNED_KEYS.has(e.code) && target.closest?.(SLIDER_SELECTOR)) return;
    if (!isActiveRef.current) return;

    if (e.code === "Space") {
      // preventDefaultでボタン自身のSpace活性化（クリック相当）を止め、二重トグルを防ぐ。
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
