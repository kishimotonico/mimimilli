import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import type { IconFC } from "./Icon";

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconFC;
  /** 点灯。boolean を渡したときだけ aria-pressed を出す */
  active?: boolean;
  /** アドレスバー内の低い高さ */
  compact?: boolean;
  children: ReactNode;
}

/** トップバー・アドレスバーの道具。アイコン＋短いラベル */
export default function ToolButton({
  icon: Icon,
  active,
  compact = false,
  className,
  type = "button",
  children,
  ...rest
}: ToolButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={active === undefined ? undefined : active}
      className={cn("mle-tool", active && "is-on", compact && "is-compact", className)}
      {...rest}
    >
      <Icon size={15} />
      {children}
    </button>
  );
}
