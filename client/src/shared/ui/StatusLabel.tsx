import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import type { IconFC } from "./Icon";

/** 状態の4区分。done=完了、work=作業中、attention=あなたの番、none=対象外 */
export type StatusTone = "done" | "work" | "attention" | "none";

const TONE_CLASS: Record<StatusTone, string> = {
  done: "text-[color-mix(in_oklch,var(--state-success)_78%,var(--ink-0))]",
  work: "text-ink-2",
  attention: "text-[color-mix(in_oklch,var(--state-danger)_85%,var(--ink-0))]",
  none: "text-ink-2",
};

interface StatusLabelProps {
  tone: StatusTone;
  icon?: IconFC;
  /** アイコンを回す（作業中の表現） */
  spinning?: boolean;
  children: ReactNode;
  className?: string;
}

export default function StatusLabel({
  tone,
  icon: Icon,
  spinning = false,
  children,
  className,
}: StatusLabelProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap font-jp text-secondary",
        TONE_CLASS[tone],
        className,
      )}
    >
      {Icon && <Icon size={12} className={cn("shrink-0", spinning && "animate-spin")} />}
      {children}
    </span>
  );
}
