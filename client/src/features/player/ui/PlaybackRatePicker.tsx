// 再生速度ピル＋メニュー。PopupContent・PlayerTransportControls・
// NowPlayingImmersiveMiniControlsで共用する。

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsPresent } from "motion/react";
import { I } from "../../../shared/ui/Icon";
import { cn } from "../../../shared/lib/cn";
import { useAnchoredPopover } from "../../../shared/ui/useAnchoredPopover";

export const RATE_PRESETS = [0.75, 1, 1.25, 1.5, 2];

const RATE_LABELS: Record<number, string> = {
  0.75: "0.75×",
  1: "1.0×",
  1.25: "1.25×",
  1.5: "1.5×",
  2: "2.0×",
};

function isRateSelected(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

interface PlaybackRatePickerProps {
  playbackRate: number;
  onSetPlaybackRate: (rate: number) => void;
  /** カバー画像等の暗い背景に重ねる表示（ポップアップ・没入ミニコントロール）。既定は素のピル */
  overlay?: boolean;
  className?: string;
  /** メニューの開閉状態が変わるたびに呼ぶ。呼び出し側で周辺要素との重なりを避けたいときに使う */
  onOpenChange?: (isOpen: boolean) => void;
}

export default function PlaybackRatePicker({
  playbackRate,
  onSetPlaybackRate,
  overlay = false,
  className,
  onOpenChange,
}: PlaybackRatePickerProps) {
  const [isOpen, setIsOpenState] = useState(false);
  const isPresent = useIsPresent();

  const setIsOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setIsOpenState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        onOpenChange?.(value);
        return value;
      });
    },
    [onOpenChange],
  );

  const { setReference, setFloating, floatingStyles } = useAnchoredPopover({
    isOpen: isOpen && isPresent,
    preferredWidth: 0,
    placement: "above",
    onClose: () => setIsOpen(false),
    closeOnScroll: true,
    closeOnFocusOut: true,
  });

  const floatingRef = useRef<HTMLDivElement | null>(null);
  const setFloatingRef = useCallback(
    (node: HTMLDivElement | null) => {
      floatingRef.current = node;
      return setFloating(node);
    },
    [setFloating],
  );

  // ポータル化したメニューはDOM上でボタンと隣接しないため、開いたら選択中の項目へ
  // 明示的にフォーカスを移す（Tab/Shift+Tabでメニューへ入れるようにする）
  useEffect(() => {
    if (!isOpen) return;
    floatingRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, [isOpen]);

  const rateLabel = RATE_LABELS[playbackRate] ?? `${playbackRate.toFixed(2)}×`;

  return (
    <div className={cn("mle-ratepick", className)}>
      {isOpen &&
        createPortal(
          <div
            ref={setFloatingRef}
            style={floatingStyles}
            className="mle-ratepick__pop"
            role="menu"
            aria-label="再生速度"
          >
            {RATE_PRESETS.map((rate) => {
              const checked = isRateSelected(playbackRate, rate);
              return (
                <button
                  key={rate}
                  role="menuitemradio"
                  aria-checked={checked}
                  className={cn("mle-ratepick__item", checked && "is-checked")}
                  onClick={() => {
                    onSetPlaybackRate(rate);
                    setIsOpen(false);
                  }}
                >
                  <span className="check">{checked && <I.check size={10} />}</span>
                  <span className="label">{RATE_LABELS[rate]}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
      <button
        ref={setReference}
        type="button"
        className={cn("mle-ratepill", overlay && "is-overlay", playbackRate !== 1 && "is-on")}
        title="再生速度"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-player-control
        onClick={() => setIsOpen((v) => !v)}
      >
        {rateLabel}
      </button>
    </div>
  );
}
