import { motion, useIsPresent } from "motion/react";
import type { ScanResult } from "@mimimilli/shared";
import { useMotionVariants } from "../../../../shared/ui/useMotionVariants";
import { I } from "../../../../shared/ui/Icon";

/** RJコード未検出/データ不整合の警告。組み合わせで両方同時に出ることがあるため1つのcollapse境界にまとめる。 */
export default function ScanWarnings({
  lastResult,
  onOpenRjCodeMissing,
}: {
  lastResult: ScanResult;
  onOpenRjCodeMissing: () => void;
}) {
  const { collapse } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = collapse();
  return (
    <motion.div
      style={{ overflow: "hidden" }}
      className="flex flex-col gap-1.5"
      inert={!isPresent}
      {...v}
    >
      {lastResult.rjCodeMissingCount > 0 ? (
        <button
          type="button"
          onClick={onOpenRjCodeMissing}
          className="flex w-full items-center gap-2 overflow-hidden rounded-[6px] border border-[color-mix(in_oklch,var(--r-mustard)_35%,transparent)] bg-[color-mix(in_oklch,var(--r-mustard)_10%,transparent)] px-3 py-2 text-left hover:bg-[color-mix(in_oklch,var(--r-mustard)_16%,transparent)]"
        >
          <I.err size={13} className="shrink-0 text-[var(--r-mustard)]" />
          <span className="flex-1 font-jp text-[12px] text-ink-0">
            RJコード未検出の作品が{lastResult.rjCodeMissingCount}件あります
          </span>
          <I.chev size={12} className="shrink-0 text-ink-3" />
        </button>
      ) : null}
      {lastResult.dataIntegrityWarning ? (
        <div className="flex w-full items-center gap-2 overflow-hidden rounded-[6px] border border-[color-mix(in_oklch,var(--r-mustard)_35%,transparent)] bg-[color-mix(in_oklch,var(--r-mustard)_10%,transparent)] px-3 py-2">
          <I.err size={13} className="shrink-0 text-[var(--r-mustard)]" />
          <span className="font-jp text-[12px] text-ink-0">
            {lastResult.dataIntegrityWarning.skippedCount}
            件の作品がデータ不整合のため除外されました
          </span>
        </div>
      ) : null}
    </motion.div>
  );
}
