// アプリ全体のキーボードショートカット。
// App 層に置き、feature 層の操作は callback として受け取る。

import { useEffect, useRef, useCallback } from "react";

interface UseGlobalShortcutsOptions {
  /** Space キーで再生/一時停止。再生中でない場合は何もしない。 */
  onTogglePlay: () => void;
  /** 現在再生中かどうか（Space の有効化条件） */
  isActive: boolean;
}

export function useGlobalShortcuts({ onTogglePlay, isActive }: UseGlobalShortcutsOptions) {
  // ref 経由にすることでコールバック変化ごとの再登録を防ぐ
  const onTogglePlayRef = useRef(onTogglePlay);
  const isActiveRef = useRef(isActive);
  onTogglePlayRef.current = onTogglePlay;
  isActiveRef.current = isActive;

  const handler = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
    if (e.code === "Space" && isActiveRef.current) {
      e.preventDefault();
      onTogglePlayRef.current();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
