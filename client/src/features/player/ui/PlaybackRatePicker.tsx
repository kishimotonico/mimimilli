// 再生速度ピル＋メニュー。PopupContent・PlayerTransportControls・
// NowPlayingImmersiveMiniControlsで共用する。

import { useEffect } from "react";
import { Menu } from "@ark-ui/react/menu";
import { useIsPresent } from "motion/react";
import { cn } from "../../../shared/lib/cn";
import { MenuPopup, MotionMenuRoot, useMotionMenu } from "../../../shared/ui/menu/MotionMenu";
import { MenuCheckColumn } from "../../../shared/ui/menu/MenuCheckColumn";
import { MENU_GUTTER, MENU_LABEL_CLASS, menuItemClass } from "../../../shared/ui/menu/menuStyles";

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
  const isPresent = useIsPresent();
  const selectedRate = RATE_PRESETS.find((rate) => isRateSelected(playbackRate, rate));
  const menu = useMotionMenu({
    positioning: { placement: "top-end", gutter: MENU_GUTTER },
    initialHighlight: selectedRate === undefined ? null : String(selectedRate),
    onOpenChange: ({ open }) => onOpenChange?.(open),
  });
  const { open, setOpen } = menu.menu.api;

  // 親のポップアップが退出に入ったら、メニューも閉じる
  useEffect(() => {
    if (!isPresent && open) setOpen(false);
  }, [isPresent, open, setOpen]);

  const rateLabel = RATE_LABELS[playbackRate] ?? `${playbackRate.toFixed(2)}×`;

  return (
    <div className={cn("mle-ratepick", className)}>
      <MotionMenuRoot handle={menu}>
        <Menu.Trigger asChild {...menu.triggerProps}>
          <button
            type="button"
            className={cn("mle-ratepill", overlay && "is-overlay", playbackRate !== 1 && "is-on")}
            title="再生速度"
            data-player-control
          >
            {rateLabel}
          </button>
        </Menu.Trigger>
        <MenuPopup origin="bottom right" narrow>
          <Menu.RadioItemGroup
            value={selectedRate === undefined ? undefined : String(selectedRate)}
            onValueChange={({ value }) => onSetPlaybackRate(Number(value))}
          >
            {RATE_PRESETS.map((rate) => (
              <Menu.RadioItem key={rate} value={String(rate)} className={menuItemClass()}>
                <MenuCheckColumn />
                <span className={MENU_LABEL_CLASS}>{RATE_LABELS[rate]}</span>
              </Menu.RadioItem>
            ))}
          </Menu.RadioItemGroup>
        </MenuPopup>
      </MotionMenuRoot>
    </div>
  );
}
