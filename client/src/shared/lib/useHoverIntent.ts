import { useEffect, useRef } from "react";

// ホバーで開く/閉じるUI（軸レールのクイックオーバーレイ等）の意図判定。開くまでは短い遅延、
// 閉じるまではトリガーとパネルの間をポインタが横切っても閉じないよう猶予を持たせる。
// トリガーとパネルがDOM上で隣接していなくても（portal等）成立する。

export interface UseHoverIntentOptions {
  onOpen: () => void;
  onClose: () => void;
  /** ホバー開始から開くまでの遅延（ms）。既定200ms（ADR-0012 §7） */
  openDelayMs?: number;
  /** ポインタが離れてから閉じるまでの猶予（ms）。トリガー⇄パネル間の移動を吸収する */
  closeDelayMs?: number;
}

export interface HoverIntentHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export function useHoverIntent({
  onOpen,
  onClose,
  openDelayMs = 200,
  closeDelayMs = 150,
}: UseHoverIntentOptions): {
  trigger: HoverIntentHandlers;
  panel: HoverIntentHandlers;
  cancelClose: () => void;
} {
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);

  const clearOpenTimer = () => {
    window.clearTimeout(openTimer.current);
    openTimer.current = undefined;
  };
  const clearCloseTimer = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  };

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- アンマウント時のクリーンアップのみ
    },
    [],
  );

  const scheduleOpen = () => {
    clearCloseTimer();
    clearOpenTimer();
    openTimer.current = window.setTimeout(onOpen, openDelayMs);
  };
  const scheduleClose = () => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimer.current = window.setTimeout(onClose, closeDelayMs);
  };

  return {
    trigger: { onPointerEnter: scheduleOpen, onPointerLeave: scheduleClose },
    panel: { onPointerEnter: clearCloseTimer, onPointerLeave: scheduleClose },
    cancelClose: clearCloseTimer,
  };
}
