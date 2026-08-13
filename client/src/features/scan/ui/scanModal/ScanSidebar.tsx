import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useMotionVariants } from "../../../../shared/ui/useMotionVariants";
import { cn } from "../../../../shared/lib/cn";
import { formatScanSidebarTime } from "../../../../shared/lib/format";
import { scanPhaseLabel, type ScanProgress } from "../../model";
import { SCAN_TAB_LABEL, SCAN_TAB_ORDER, type ScanTabKey } from "./types";

interface ScanSidebarProps {
  active: ScanTabKey;
  onSelect: (tab: ScanTabKey) => void;
  counts: Record<ScanTabKey, number>;
  skippedCount: number | null;
  libraryTotal: number | null;
  scanning: boolean;
  progress: ScanProgress | null;
  lastScanTime: string | null;
  showCompletedHint: boolean;
}

export default function ScanSidebar({
  active,
  onSelect,
  counts,
  skippedCount,
  libraryTotal,
  scanning,
  progress,
  lastScanTime,
  showCompletedHint,
}: ScanSidebarProps) {
  const status: "scanning" | "completed" | "lastScan" = scanning
    ? "scanning"
    : showCompletedHint
      ? "completed"
      : "lastScan";

  return (
    <nav
      aria-label="スキャン結果"
      className="flex w-[148px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-line-soft px-2.5 py-3"
    >
      <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-0.5">
        {SCAN_TAB_ORDER.map((tab) => (
          <ScanSidebarTab
            key={tab}
            tab={tab}
            selected={tab === active}
            count={counts[tab]}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t border-line-soft pt-2.5">
        <SidebarSummaryRow label="更新なし" value={skippedCount} />
        <SidebarSummaryRow label="ライブラリ全体" value={libraryTotal} />
      </div>

      <div className="flex flex-col gap-1 border-t border-line-soft pt-2.5">
        <p className="font-sans text-[9.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
          最終スキャン
        </p>
        <div className="relative flex min-h-[14px] flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {status === "scanning" && <SidebarStatusScanning key="scanning" progress={progress} />}
            {status === "completed" && <SidebarStatusCompleted key="completed" />}
            {status === "lastScan" && (
              <SidebarStatusLastScan key="lastScan" lastScanTime={lastScanTime} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}

function ScanSidebarTab({
  tab,
  selected,
  count,
  onSelect,
}: {
  tab: ScanTabKey;
  selected: boolean;
  count: number;
  onSelect: (tab: ScanTabKey) => void;
}) {
  const label = SCAN_TAB_LABEL[tab];
  return (
    <button
      type="button"
      role="tab"
      id={`scan-tab-${tab}`}
      aria-selected={selected}
      aria-controls={`scan-tabpanel-${tab}`}
      aria-label={`${label}（${count}件）`}
      onClick={() => onSelect(tab)}
      className={cn(
        "flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 text-left font-jp text-[12px] transition-colors",
        selected ? "bg-paper-2 text-ink-0" : "text-ink-2 hover:bg-paper-2 hover:text-ink-0",
      )}
    >
      <span aria-hidden="true" className="truncate">
        {label}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums",
          tab === "needsAttention" && count > 0
            ? "bg-[color-mix(in_oklch,var(--r-coral)_20%,transparent)] text-[var(--r-coral)]"
            : "bg-paper-3 text-ink-2",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function SidebarSummaryRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-jp text-[10.5px] text-ink-2">{label}</span>
      <span className="font-mono text-[11px] font-semibold text-ink-0 tabular-nums">
        {value ?? "—"}
      </span>
    </div>
  );
}

function SidebarStatusScanning({ progress }: { progress: ScanProgress | null }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : null;
  return (
    <motion.div className="flex flex-col gap-1" inert={!isPresent} {...v}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10.5px] text-ink-2">
          {progress ? scanPhaseLabel(progress.phase) : "準備中"}
        </span>
        <span className="font-mono text-[10px] text-ink-3 tabular-nums">
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

function SidebarStatusCompleted() {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.span className="font-mono text-[10.5px] text-[var(--r-leaf)]" inert={!isPresent} {...v}>
      完了しました
    </motion.span>
  );
}

function SidebarStatusLastScan({ lastScanTime }: { lastScanTime: string | null }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.span className="font-mono text-[10.5px] text-ink-2" inert={!isPresent} {...v}>
      {formatScanSidebarTime(lastScanTime)}
    </motion.span>
  );
}
