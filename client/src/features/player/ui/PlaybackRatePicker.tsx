// 再生速度ピル＋メニュー。PopupContent（カバー画像上のオーバーレイ）、
// PlayerTransportControls（再生中タブ通常モード）、NowPlayingImmersiveMiniControls
// （没入モードのミニコントロール）で共用する。開閉・外側クリック/Escape/スクロール/
// フォーカス外し時の挙動は元の PopupContent 実装を踏襲する。

import { useEffect, useRef, useState } from "react";
import { useIsPresent } from "motion/react";
import { I } from "../../../shared/ui/Icon";
import { cn } from "../../../shared/lib/cn";

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
}

export default function PlaybackRatePicker({
  playbackRate,
  onSetPlaybackRate,
  overlay = false,
  className,
}: PlaybackRatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isPresent = useIsPresent();

  useEffect(() => {
    if (!isOpen || !isPresent) return;

    const closeMenu = () => setIsOpen(false);

    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    const handleFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (rootRef.current && next && rootRef.current.contains(next)) return;
      closeMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", closeMenu, true);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", closeMenu, true);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, [isOpen, isPresent]);

  const rateLabel = RATE_LABELS[playbackRate] ?? `${playbackRate.toFixed(2)}×`;

  return (
    <div className={cn("mle-ratepick", className)} ref={rootRef}>
      {isOpen && (
        <div className="mle-ratepick__pop" role="menu" aria-label="再生速度">
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
        </div>
      )}
      <button
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
