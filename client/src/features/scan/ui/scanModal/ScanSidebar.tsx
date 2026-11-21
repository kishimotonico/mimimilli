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
import { useScanStatusView } from "./useScanStatusView";
import type { ScanTabCounts } from "./scanTabs";
import { SCAN_TAB_LABEL, SCAN_TAB_ORDER, type ScanTabKey } from "./types";

interface ScanSidebarProps {
  active: ScanTabKey | null;
  onSelect: (tab: ScanTabKey) => void;
  counts: ScanTabCounts;
  lastScanTime: string | null;
  /** 起動後にスキャンが完了していない。スキャンボタンを主ボタンにする */
  scanPending: boolean;
  onStart: () => void;
  onFullScan: () => void;
  onCancel: () => void;
}

const HEADING_CLASS = "h-[18px] font-jp text-secondary font-medium leading-[18px] text-ink-2";
const VALUE_CLASS = "h-[18px] font-mono text-secondary leading-[18px] text-ink-1";

export default function ScanSidebar({
  active,
  onSelect,
  counts,
  lastScanTime,
  scanPending,
  onStart,
  onFullScan,
  onCancel,
}: ScanSidebarProps) {
  return (
    <nav
      aria-label="スキャン結果"
      className="flex w-[180px] shrink-0 flex-col overflow-y-auto border-r border-line-soft py-3 pr-2.5"
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

      <ScanSidebarControls
        lastScanTime={lastScanTime}
        scanPending={scanPending}
        onStart={onStart}
        onFullScan={onFullScan}
        onCancel={onCancel}
      />
    </nav>
  );
}

/** 状態欄と開始・中止のボタン。進捗の購読はここに閉じ、タブの一覧を描き直さない。 */
function ScanSidebarControls({
  lastScanTime,
  scanPending,
  onStart,
  onFullScan,
  onCancel,
}: Pick<ScanSidebarProps, "lastScanTime" | "scanPending" | "onStart" | "onFullScan" | "onCancel">) {
  const status = useScanStatusView(lastScanTime);
  const inProgress = status.kind === "running" || status.kind === "cancelling";
  return (
    <div className="mt-auto flex h-[116px] shrink-0 flex-col border-t border-line-soft pt-2.5 pl-2.5">
      <div className="relative min-h-0 flex-1">
        <AnimatePresence initial={false} mode="wait">
          <SidebarStatus key={status.kind} status={status} />
        </AnimatePresence>
      </div>
      <div className="relative h-[26px] shrink-0">
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
              primary={scanPending}
              onStart={onStart}
              onFullScan={onFullScan}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
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
  count: number | null;
  onSelect: (tab: ScanTabKey) => void;
}) {
  const label = SCAN_TAB_LABEL[tab];
  const shownCount = count !== null && count > 0 ? count : null;
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
        "flex h-[30px] items-center justify-between gap-2 rounded-r-[6px] pr-2 pl-3 text-left font-jp text-body transition-colors",
        selected
          ? "bg-paper-2 font-bold text-ink-0 shadow-[inset_2px_0_0_var(--acc)]"
          : "text-ink-1 hover:bg-paper-2 hover:text-ink-0",
      )}
    >
      <span aria-hidden="true" className="truncate">
        {label}
      </span>
      <span aria-hidden="true" className="inline-grid h-[18px] min-w-6 shrink-0 place-items-center">
        {shownCount !== null && (
          <span
            className={cn(
              "inline-grid h-[18px] min-w-5 place-items-center rounded-pill px-1.5 font-mono text-secondary font-medium tabular-nums",
              tab === "needsAttention"
                ? "bg-[color-mix(in_oklch,var(--state-danger)_11%,transparent)] text-[var(--state-danger)]"
                : "bg-paper-3 text-ink-1",
            )}
          >
            {shownCount}
          </span>
        )}
      </span>
    </button>
  );
}

function SidebarStartButton({
  status,
  primary,
  onStart,
  onFullScan,
}: {
  status: ScanStatusView;
  primary: boolean;
  onStart: () => void;
  onFullScan: () => void;
}) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.div className="absolute inset-0" inert={!isPresent} {...v}>
      <SplitButton
        variant={primary ? "primary" : "ghost"}
        size="sm"
        className="w-full"
        menuLabel="スキャンの方法"
        onClick={onStart}
        items={[{ key: "full", label: "すべての作品を読み直す", onSelect: onFullScan }]}
      >
        <I.refresh size={14} />
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
      className={buttonClass("danger-quiet", "sm", {
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
          <p className={cn(HEADING_CLASS, "flex items-center gap-1 text-[var(--state-success)]")}>
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
          <p className={cn(HEADING_CLASS, "flex items-center gap-1 text-[var(--state-danger)]")}>
            <I.err size={12} />
            スキャンできませんでした
          </p>
          <p className="truncate font-jp text-secondary text-ink-1" title={status.reason}>
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
        <span className="truncate font-mono text-secondary text-ink-2">
          {progress ? scanPhaseLabel(progress.phase) : "準備中"}
        </span>
        <span className="shrink-0 font-mono text-secondary text-ink-2 tabular-nums">
          {progress && progress.total > 0 ? `${progress.processed}/${progress.total}` : "…"}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-paper-3">
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
