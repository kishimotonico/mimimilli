import { AnimatePresence, motion, useIsPresent } from "motion/react";
import type { ReactNode } from "react";
import { useMotionVariants } from "../../../../shared/ui/useMotionVariants";
import { cn } from "../../../../shared/lib/cn";
import { formatScanDateTime } from "../../../../shared/lib/format";
import { buttonClass } from "../../../../shared/ui/Button";
import { I } from "../../../../shared/ui/Icon";
import SplitButton from "../../../../shared/ui/SplitButton";
import { scanPhaseLabel, type ScanProgress } from "../../model";
import type { ScanStatusView } from "../../model/scanStatusView";
import { SCAN_TAB_LABEL, SCAN_TAB_ORDER, SCAN_TAB_WITH_COUNT, type ScanTabKey } from "./types";

interface ScanSidebarProps {
  active: ScanTabKey;
  onSelect: (tab: ScanTabKey) => void;
  counts: Partial<Record<ScanTabKey, number>>;
  status: ScanStatusView;
  onStart: () => void;
  onFullScan: () => void;
  onCancel: () => void;
}

const HEADING_CLASS = "font-sans text-label font-semibold tracking-[0.06em] text-ink-2";
const VALUE_CLASS = "font-mono text-mono text-ink-2";

export default function ScanSidebar({
  active,
  onSelect,
  counts,
  status,
  onStart,
  onFullScan,
  onCancel,
}: ScanSidebarProps) {
  const inProgress = status.kind === "running" || status.kind === "cancelling";
  return (
    <nav
      aria-label="スキャン結果"
      className="flex w-[160px] shrink-0 flex-col overflow-y-auto border-r border-line-soft py-3 pr-2.5"
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

      <div className="mt-auto flex flex-col gap-2 border-t border-line-soft pt-2.5 pl-2.5">
        <div className="relative h-[46px]">
          <AnimatePresence initial={false} mode="wait">
            <SidebarStatus key={status.kind} status={status} />
          </AnimatePresence>
        </div>
        <div className="relative h-9">
          <AnimatePresence initial={false} mode="wait">
            {inProgress ? (
              <SidebarCancelButton
                key="cancel"
                disabled={status.kind === "cancelling"}
                onClick={onCancel}
              />
            ) : (
              <SidebarStartButton
                key="start"
                status={status}
                onStart={onStart}
                onFullScan={onFullScan}
              />
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
  count: number | undefined;
  onSelect: (tab: ScanTabKey) => void;
}) {
  const label = SCAN_TAB_LABEL[tab];
  const shownCount =
    SCAN_TAB_WITH_COUNT.has(tab) && !selected && count !== undefined && count > 0 ? count : null;
  return (
    <button
      type="button"
      role="tab"
      id={`scan-tab-${tab}`}
      aria-selected={selected}
      aria-controls={`scan-tabpanel-${tab}`}
      aria-label={shownCount === null ? label : `${label}（${shownCount}件）`}
      onClick={() => onSelect(tab)}
      className={cn(
        "flex items-center justify-between gap-2 rounded-r-[6px] py-1.5 pr-2 pl-2.5 text-left font-jp text-control transition-colors",
        selected
          ? "bg-paper-2 font-semibold text-ink-0 shadow-[inset_2px_0_0_var(--acc)]"
          : "text-ink-2 hover:bg-paper-2 hover:text-ink-0",
      )}
    >
      <span aria-hidden="true" className="truncate">
        {label}
      </span>
      {shownCount !== null && (
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-caption font-semibold tabular-nums",
            tab === "needsAttention"
              ? "bg-[color-mix(in_oklch,var(--r-coral)_20%,transparent)] text-[var(--r-coral)]"
              : "bg-paper-3 text-ink-2",
          )}
        >
          {shownCount}
        </span>
      )}
    </button>
  );
}

function SidebarStartButton({
  status,
  onStart,
  onFullScan,
}: {
  status: ScanStatusView;
  onStart: () => void;
  onFullScan: () => void;
}) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  const neverScanned = status.kind === "idle" && status.at === null;
  return (
    <motion.div className="absolute inset-0" inert={!isPresent} {...v}>
      <SplitButton
        variant={neverScanned ? "primary" : "ghost"}
        size="lg"
        className="w-full"
        menuLabel="スキャンの方法"
        onClick={onStart}
        items={[{ key: "full", label: "すべての作品を読み直す", onSelect: onFullScan }]}
      >
        <I.refresh size={12} />
        {status.kind === "failed" ? "再試行" : "スキャン"}
      </SplitButton>
    </motion.div>
  );
}

function SidebarCancelButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      inert={!isPresent}
      {...v}
      className={buttonClass("danger-quiet", "lg", {
        disabled,
        className: "absolute inset-0 w-full justify-center",
      })}
    >
      <I.x size={12} />
      スキャンを中止
    </motion.button>
  );
}

function SidebarStatus({ status }: { status: ScanStatusView }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.div className="absolute inset-0 flex flex-col gap-1" inert={!isPresent} {...v}>
      {renderStatus(status)}
    </motion.div>
  );
}

function renderStatus(status: ScanStatusView): ReactNode {
  switch (status.kind) {
    case "idle":
      return status.at === null ? (
        <p className={HEADING_CLASS}>まだスキャンしていません</p>
      ) : (
        <>
          <p className={HEADING_CLASS}>最終スキャン</p>
          <p className={VALUE_CLASS}>{formatScanDateTime(status.at)}</p>
        </>
      );
    case "running":
    case "cancelling":
      return (
        <>
          <p className={HEADING_CLASS}>
            {status.kind === "running" ? "スキャン中" : "中止しています…"}
          </p>
          <ProgressRow progress={status.progress} dim={status.kind === "cancelling"} />
        </>
      );
    case "completed":
      return (
        <>
          <p className={cn(HEADING_CLASS, "flex items-center gap-1 text-[var(--r-leaf)]")}>
            <I.check size={12} />
            スキャン完了
          </p>
          <p className={VALUE_CLASS}>{formatScanDateTime(status.at)}</p>
        </>
      );
    case "cancelled":
      return (
        <>
          <p className={HEADING_CLASS}>スキャンを中止しました</p>
          <p className={VALUE_CLASS}>{formatScanDateTime(status.at)}</p>
        </>
      );
    case "failed":
      return (
        <>
          <p className={cn(HEADING_CLASS, "flex items-center gap-1 text-[var(--r-coral)]")}>
            <I.err size={12} />
            スキャンできませんでした
          </p>
          <p className="truncate font-jp text-caption text-ink-2" title={status.reason}>
            {status.reason}
          </p>
        </>
      );
  }
}

function ProgressRow({ progress, dim }: { progress: ScanProgress | null; dim: boolean }) {
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : null;
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-mono text-caption text-ink-2">
          {progress ? scanPhaseLabel(progress.phase) : "準備中"}
        </span>
        <span className="shrink-0 font-mono text-caption text-ink-2 tabular-nums">
          {progress && progress.total > 0 ? `${progress.processed}/${progress.total}` : "…"}
        </span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-paper-2">
        <div
          className={cn(
            "h-full rounded-full bg-acc transition-[width] duration-300 ease-out",
            dim && "opacity-40",
            pct === null && "w-1/3 animate-pulse",
          )}
          style={pct !== null ? { width: `${pct}%` } : undefined}
        />
      </div>
    </>
  );
}
