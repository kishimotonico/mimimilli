// 画面下張り付きバーの音量ボタン。単体のミュートボタンはこのアプリの利用場面では
// ほぼ不要なため、クリックで小さなポップオーバーを開き、その中のスライダーで
// 音量を直接調整する形に置き換える（ミュートしたければスライダーを0まで下げればよい）。
// 開閉・外側クリック/Escape・フォーカス復帰は他のポップオーバーと同じ
// usePopoverDismissal を使って揃える。

import { useEffect, useRef, useState } from "react";
import { I } from "../../../shared/ui/Icon";
import { usePopoverDismissal } from "../../library/ui/preview/useAnchoredPopover";

interface BarVolumePopoverProps {
  volume: number;
  onSetVolume: (volume: number) => void;
}

export default function BarVolumePopover({ volume, onSetVolume }: BarVolumePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  usePopoverDismissal({
    isOpen,
    onOutsideClick: () => setIsOpen(false),
    onEscape: () => setIsOpen(false),
    anchorRef: rootRef,
  });

  // 開いたらスライダーへ初期フォーカスする（他のポップオーバーと同じ「開いたら中身へ」規約）
  useEffect(() => {
    if (isOpen) sliderRef.current?.focus();
  }, [isOpen]);

  return (
    <div className="mle-bar1__vol" ref={rootRef}>
      <button
        type="button"
        className={`mle-bar1__track-button ${volume === 0 ? "is-muted" : ""}`}
        aria-label={`音量 ${volume}%`}
        title={`音量 ${volume}%`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((open) => !open);
        }}
      >
        <I.volume size={16} />
      </button>
      {isOpen && (
        <div className="mle-bar1__volpop">
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={100}
            value={volume}
            aria-label="音量"
            onChange={(e) => onSetVolume(Number(e.target.value))}
            // バー本体のonClick（ポップアップ展開）へスライダー操作を伝播させないためのガード
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
