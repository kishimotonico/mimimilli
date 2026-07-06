import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import type { IconFC } from "./Icon";

export type IconButtonSize = "sm" | "md" | "lg";

// 箱サイズとアイコン描画サイズを対で固定し、呼び出し側での二重管理を無くす。
const BOX_CLASS: Record<IconButtonSize, string> = {
  sm: "h-[26px] w-[26px]",
  md: "h-[30px] w-[30px]",
  lg: "h-[38px] w-[38px]",
};

const ICON_PX: Record<IconButtonSize, number> = { sm: 14, md: 16, lg: 20 };

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> {
  icon: IconFC;
  /** aria-label と title ツールチップの両方に使う */
  label: string;
  size?: IconButtonSize;
  active?: boolean;
}

export default function IconButton({
  icon: Icon,
  label,
  size = "md",
  active = false,
  disabled = false,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const stateClass = disabled
    ? "cursor-not-allowed text-ink-4"
    : active
      ? "text-acc-ink bg-acc-soft"
      : "text-ink-1 hover:bg-paper-2 active:bg-paper-3";

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2 transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2",
        BOX_CLASS[size],
        stateClass,
        className,
      )}
      {...rest}
    >
      <Icon size={ICON_PX[size]} />
    </button>
  );
}
