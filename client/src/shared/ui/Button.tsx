import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import type { IconFC } from "./Icon";

export type ButtonVariant = "primary" | "ghost" | "quiet";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** 先頭に置くアイコン */
  icon?: IconFC;
  active?: boolean;
  children?: ReactNode;
}

function stateClass(variant: ButtonVariant, active: boolean, disabled: boolean): string {
  if (disabled) {
    return variant === "primary"
      ? "cursor-not-allowed bg-paper-2 text-ink-4"
      : "cursor-not-allowed text-ink-4";
  }
  if (active) return "bg-acc-soft text-acc-ink";
  switch (variant) {
    case "primary": return "bg-ink-0 text-paper-1 hover:bg-acc";
    case "ghost": return "bg-paper-2 text-ink-1 hover:bg-paper-3 hover:text-ink-0";
    case "quiet": return "bg-transparent text-ink-2 hover:bg-paper-2 hover:text-ink-0";
  }
}

export default function Button({
  variant = "ghost",
  icon: Icon,
  active = false,
  disabled = false,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={active || undefined}
      disabled={disabled}
      className={cn(
        "inline-flex h-[26px] items-center gap-[5px] whitespace-nowrap rounded-pill px-[10px]",
        "font-sans text-[11px] font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2",
        stateClass(variant, active, disabled),
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={12} />}
      {children}
    </button>
  );
}
