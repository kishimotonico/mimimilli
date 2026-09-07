import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../lib/cn";
import type { IconFC } from "./Icon";

export type ButtonVariant = "primary" | "ghost" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 先頭に置くアイコン */
  icon?: IconFC;
  active?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

// 高さ・余白・文字サイズをサイズ契約として固定する（IconButtonのBOX_CLASSと同じ思想）。
const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-[26px] gap-[5px] px-[10px] text-control",
  md: "h-[34px] gap-1.5 px-3.5 text-body",
  lg: "h-9 gap-1.5 px-4 text-body",
};

function stateClass(variant: ButtonVariant, active: boolean, disabled: boolean): string {
  if (disabled) {
    return variant === "primary"
      ? "cursor-not-allowed bg-paper-2 text-ink-4"
      : "cursor-not-allowed text-ink-4";
  }
  if (active) return "bg-acc-soft text-acc-ink";
  switch (variant) {
    case "primary":
      return "bg-ink-0 text-paper-1 hover:bg-acc";
    case "ghost":
      return "bg-paper-2 text-ink-1 hover:bg-paper-3 hover:text-ink-0";
    case "quiet":
      return "bg-transparent text-ink-2 hover:bg-paper-2 hover:text-ink-0";
    case "danger":
      return "border border-[color-mix(in_oklch,var(--r-coral)_45%,transparent)] bg-[color-mix(in_oklch,var(--r-coral)_10%,transparent)] text-ink-0 hover:bg-[color-mix(in_oklch,var(--r-coral)_16%,transparent)]";
  }
}

/**
 * Buttonの見た目（サイズ・variant）だけを、素の`<button>`を使えない箇所
 * （motion.button等）向けにクラス文字列として切り出す。
 */
export function buttonClass(
  variant: ButtonVariant,
  size: ButtonSize = "sm",
  options: { active?: boolean; disabled?: boolean; className?: string } = {},
): string {
  const { active = false, disabled = false, className } = options;
  return cn(
    "inline-flex items-center whitespace-nowrap rounded-pill",
    "font-sans font-medium transition-colors",
    SIZE_CLASS[size],
    stateClass(variant, active, disabled),
    className,
  );
}

export default function Button({
  variant = "ghost",
  size = "sm",
  icon: Icon,
  active = false,
  disabled = false,
  className,
  children,
  type = "button",
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active || undefined}
      disabled={disabled}
      className={buttonClass(variant, size, { active, disabled, className })}
      {...rest}
    >
      {Icon && <Icon size={12} />}
      {children}
    </button>
  );
}
