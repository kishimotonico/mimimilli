import { useEffect, useCallback } from "react";
import { useLatest } from "../../../shared/lib/useLatest";
import { LAYER_CONTENT_SELECTOR } from "../../../shared/ui/layer/layerDom";

/** ネイティブ操作を優先し、常に（全キー）グローバルショートカットの対象から外す要素。 */
const SHORTCUT_EXEMPT_SELECTOR =
  'input, textarea, select, [contenteditable], [role="menu"], [role="listbox"], button, a';

/** 再生/一時停止・前後トラック・±10秒・ループ・速度・音量トリガーなど、常設プレイヤーの
 *  操作ボタン。Space はここにフォーカスがあっても常にグローバルの再生/一時停止として扱う
 *  （Web標準のボタン活性化に任せると、ボタンごとに別々の意味でSpaceが反応してしまうため）。 */
const PLAYER_CONTROL_SELECTOR = "[data-player-control]";

/** カスタムスライダー（シーク行・ABハンドル）が自前で処理するキー。Spaceにはスライダー
 *  側のネイティブ動作がないため対象外にせず、グローバル側で処理する。 */
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
  const onTogglePlayRef = useLatest(onTogglePlay);
  const onSeekRelativeRef = useLatest(onSeekRelative);
  const isActiveRef = useLatest(isActive);

  const isShortcutBlocked = useCallback(() => {
    // モーダルdialogが開いている間は、フォーカス位置に関わらず背後の再生を操作しない。
    return document.querySelector("dialog[open]") !== null || !isActiveRef.current;
  }, [isActiveRef]);

  // プレイヤー操作ボタンの Space は、keydown で開く Ark のトリガーより先に止める必要があるので capture で扱う。
  const handleControlSpace = useCallback(
    (e: KeyboardEvent) => {
      if (e.code !== "Space" || isShortcutBlocked()) return;
      if (!(e.target instanceof Element) || e.target.closest(LAYER_CONTENT_SELECTOR)) return;
      if (!e.target.closest(PLAYER_CONTROL_SELECTOR)) return;
      e.preventDefault();
      e.stopPropagation();
      onTogglePlayRef.current();
    },
    [isShortcutBlocked, onTogglePlayRef],
  );

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isShortcutBlocked()) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest(SHORTCUT_EXEMPT_SELECTOR) || target.closest(LAYER_CONTENT_SELECTOR))
        return;
      if (SLIDER_OWNED_KEYS.has(e.code) && target.closest(SLIDER_SELECTOR)) return;

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
    },
    [isShortcutBlocked, onTogglePlayRef, onSeekRelativeRef],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleControlSpace, true);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handleControlSpace, true);
      window.removeEventListener("keydown", handler);
    };
  }, [handleControlSpace, handler]);
}
