import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useMotionVariants } from "../../../../shared/ui/useMotionVariants";
import { I } from "../../../../shared/ui/Icon";
import { cn } from "../../../../shared/lib/cn";
import { scanPhaseLabel, type ScanProgress } from "../../model";
import { formatLastScanTime } from "../../../../shared/lib/format";

type StatusState = "scanning" | "completed" | "lastScan";

/** 「最終スキャン: 日時」⇄「実行中のフェーズと進捗」⇄「完了しました」を同じ行の位置で入れ替える。
 *  完了サインは justCompleted の間だけ一時的に挟まり、その後は最終スキャン日時に戻る。
 *  排他3状態を単一スロット化し、sync（並置クロスフェード）+ 退出absoluteで入れ替える。 */
export default function StatusRow({
  scanning,
  progress,
  lastScanTime,
  showCompletedHint,
}: {
  scanning: boolean;
  progress: ScanProgress | null;
  lastScanTime: string | null;
  showCompletedHint: boolean;
}) {
  const state: StatusState = scanning ? "scanning" : showCompletedHint ? "completed" : "lastScan";

  return (
    <div className="relative flex min-h-[20px] flex-col gap-1.5">
      <AnimatePresence initial={false}>
        {state === "scanning" && <StatusRowScanning key="scanning" progress={progress} />}
        {state === "completed" && <StatusRowCompleted key="completed" />}
        {state === "lastScan" && <StatusRowLastScan key="lastScan" lastScanTime={lastScanTime} />}
      </AnimatePresence>
    </div>
  );
}

function StatusRowScanning({ progress }: { progress: ScanProgress | null }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : null;
  return (
    <motion.div className="flex flex-col gap-1.5" inert={!isPresent} {...v}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-sans text-[13px] font-medium text-ink-0">
          {progress ? scanPhaseLabel(progress.phase) : "準備中"}
        </span>
        <span className="font-mono text-[11px] text-ink-2 tabular-nums">
          {progress && progress.total > 0 ? `${progress.processed}/${progress.total}` : "…"}
        </span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-paper-2">
        <div
          className={cn(
            "h-full rounded-full bg-acc transition-[width] duration-300 ease-out",
            pct === null && "w-1/3 animate-pulse",
          )}
          style={pct !== null ? { width: `${pct}%` } : undefined}
        />
      </div>
    </motion.div>
  );
}

function StatusRowCompleted() {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.div className="flex items-center gap-1.5" inert={!isPresent} {...v}>
      <I.check size={12} className="text-[var(--r-leaf)]" />
      <span className="font-sans text-[13px] font-medium text-ink-0">完了しました</span>
    </motion.div>
  );
}

function StatusRowLastScan({ lastScanTime }: { lastScanTime: string | null }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.div inert={!isPresent} {...v}>
      <span className="font-mono text-[11px] text-ink-2">
        最終スキャン: {formatLastScanTime(lastScanTime)}
      </span>
    </motion.div>
  );
}
