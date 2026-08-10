import { cn } from "../../../../shared/lib/cn";
import type { ScanResult } from "@mimimilli/shared";

export type StatKey = keyof Pick<
  ScanResult,
  "registered" | "newlyGenerated" | "errors" | "missing"
>;
export const STAT_KEYS: StatKey[] = ["registered", "newlyGenerated", "errors", "missing"];

const STAT_TILES: Array<{
  key: StatKey;
  label: string;
  tone: (value: number) => string;
}> = [
  { key: "registered", label: "登録済み", tone: () => "text-ink-0" },
  { key: "newlyGenerated", label: "新規検出", tone: () => "text-ink-0" },
  { key: "errors", label: "エラー", tone: (v) => (v > 0 ? "text-[var(--r-coral)]" : "text-ink-3") },
  {
    key: "missing",
    label: "行方不明",
    tone: (v) => (v > 0 ? "text-[var(--r-mustard)]" : "text-ink-3"),
  },
];

/** 常に4枠を表示し、値だけが更新される（実行中も直前の値のまま）。
 *  changedKeys に含まれる枠は、直前のスキャンで値が変わったことを示す短い強調を出す。 */
export default function StatsGrid({
  result,
  changedKeys,
}: {
  result: ScanResult | null;
  changedKeys: ReadonlySet<StatKey>;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {STAT_TILES.map(({ key, label, tone }) => {
        const value = result?.[key] ?? null;
        const highlighted = changedKeys.has(key);
        return (
          <div
            key={key}
            className={cn(
              "flex flex-col gap-0.5 rounded-[6px] border px-2.5 py-2 transition-colors duration-700",
              highlighted
                ? "border-[color-mix(in_oklch,var(--acc)_45%,transparent)] bg-[color-mix(in_oklch,var(--acc)_12%,transparent)]"
                : "border-line-soft bg-paper-0",
            )}
          >
            <span
              className={cn(
                "font-mono text-[16px] leading-none font-semibold tabular-nums",
                value === null ? "text-ink-4" : tone(value),
              )}
            >
              {value ?? "—"}
            </span>
            <span className="font-jp text-[10px] text-ink-3">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
