import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "../lib/cn";
import type { IconFC } from "./Icon";

export type IconButtonSize = "xs" | "sm" | "md" | "lg";

// "bare" は hover/active の背景ユーティリティを出さない。呼び出し側が親要素の
// hover背景と衝突しない背景色をCSSで指定したい場合（AND追加ボタン等）に使う。
export type IconButtonVariant = "default" | "bare";

// 有効時の文字色。無効時は tone に関わらず常に ink-4 が勝つ。
export type IconButtonTone = "default" | "muted" | "faint" | "danger";

const TONE_CLASS: Record<IconButtonTone, string> = {
  default: "text-ink-1",
  muted: "text-ink-2 hover:text-ink-0",
  faint: "text-ink-3 hover:text-ink-1 focus-visible:text-ink-1",
  danger: "text-ink-1 hover:text-[var(--state-danger)]",
};

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
  /** 有効時の文字色。`muted` は ink-2（hoverで ink-0）、`faint` は ink-3（hover/focusで ink-1）、`danger` は hoverで赤 */
  tone?: IconButtonTone;
  ref?: Ref<HTMLButtonElement>;
}

export default function IconButton({
  icon: Icon,
  label,
  title,
  size = "md",
  active,
  variant = "default",
  tone = "default",
  disabled = false,
  "aria-disabled": ariaDisabled,
  className,
  ref,
  type = "button",
  ...rest
}: IconButtonProps) {
  const looksDisabled = disabled || ariaDisabled === true || ariaDisabled === "true";
  const stateClass = looksDisabled
    ? "cursor-not-allowed text-ink-4"
    : active
      ? "text-acc-ink bg-acc-soft"
      : variant === "bare"
        ? TONE_CLASS[tone]
        : `${TONE_CLASS[tone]} hover:bg-paper-2 active:bg-paper-3`;

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
        BOX_CLASS[size],
        stateClass,
        className,
      )}
      {...rest}
      aria-disabled={ariaDisabled}
    >
      <Icon size={ICON_PX[size]} />
    </button>
  );
}
