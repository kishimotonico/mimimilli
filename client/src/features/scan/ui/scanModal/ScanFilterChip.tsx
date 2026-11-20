import type { ReactNode } from "react";
import { cn } from "../../../../shared/lib/cn";
import { I } from "../../../../shared/ui/Icon";

interface ScanFilterChipProps {
  pressed: boolean;
  count: number;
  icon?: ReactNode;
  /** 押下中に右端へ解除の×を出す */
  clearable?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** ツールバーの絞り込み。丸ピルで、選択中だけアクセントの面にする。 */
export default function ScanFilterChip({
  pressed,
  count,
  icon,
  clearable = false,
  onClick,
  children,
}: ScanFilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-[26px] items-center gap-[5px] whitespace-nowrap rounded-pill border px-2.5 font-jp text-control",
        pressed
          ? "border-transparent bg-acc-soft font-medium text-acc-ink"
          : "border-line bg-paper-1 text-ink-1 hover:bg-paper-2",
      )}
    >
      {icon}
      {children}
      <span className="font-mono tabular-nums">{count}</span>
      {pressed && clearable && <I.x size={12} />}
    </button>
  );
}
