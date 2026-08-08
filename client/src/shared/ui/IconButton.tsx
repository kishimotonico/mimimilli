import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "../lib/cn";
import type { IconFC } from "./Icon";

export type IconButtonSize = "xs" | "sm" | "md" | "lg";

// "bare" は hover/active の背景ユーティリティを出さない。呼び出し側が親要素の
// hover背景と衝突しない背景色をCSSで指定したい場合（AND追加ボタン等）に使う。
export type IconButtonVariant = "default" | "bare";

// 箱サイズ・角丸・アイコン描画サイズを対で固定し、呼び出し側での二重管理を無くす。
const BOX_CLASS: Record<IconButtonSize, string> = {
  xs: "h-5 w-5 rounded-1",
  sm: "h-[26px] w-[26px] rounded-2",
  md: "h-[30px] w-[30px] rounded-2",
  lg: "h-[38px] w-[38px] rounded-2",
};

const ICON_PX: Record<IconButtonSize, number> = { xs: 12, sm: 14, md: 16, lg: 20 };

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "title"
> {
  icon: IconFC;
  /** 支援技術向けの名前（aria-label） */
  label: string;
  /** ホバー時のツールチップ。省略時は label と同じ */
  title?: string;
  size?: IconButtonSize;
  /** トグル状態。boolean を渡したときだけ aria-pressed を出す */
  active?: boolean;
  variant?: IconButtonVariant;
  ref?: Ref<HTMLButtonElement>;
}

export default function IconButton({
  icon: Icon,
  label,
  title,
  size = "md",
  active,
  variant = "default",
  disabled = false,
  className,
  ref,
  type = "button",
  ...rest
}: IconButtonProps) {
  const stateClass = disabled
    ? "cursor-not-allowed text-ink-4"
    : active
      ? "text-acc-ink bg-acc-soft"
      : variant === "bare"
        ? "text-ink-1"
        : "text-ink-1 hover:bg-paper-2 active:bg-paper-3";

  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-colors",
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
