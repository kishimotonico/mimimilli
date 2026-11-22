import { I } from "../../shared/ui/Icon";
import type { ScanEntryRing } from "../../features/scan/model/scanEntryRing";

interface ScanEntryButtonProps {
  ring: ScanEntryRing;
  unseen: boolean;
  onOpen: () => void;
}

const RING_RADIUS = 13;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function scanEntryLabel(running: boolean, unseen: boolean): string {
  if (running && unseen) return "スキャン（実行中・新しい項目あり）";
  if (running) return "スキャン（実行中）";
  if (unseen) return "スキャン（新しい項目あり）";
  return "スキャン";
}

export default function ScanEntryButton({ ring, unseen, onOpen }: ScanEntryButtonProps) {
  const running = ring.kind !== "none";
  const arcLength =
    ring.kind === "determinate"
      ? RING_CIRCUMFERENCE * Math.min(1, Math.max(0, ring.ratio))
      : RING_CIRCUMFERENCE / 4;

  return (
    <button
      type="button"
      className="mle-tool"
      aria-label={scanEntryLabel(running, unseen)}
      onClick={onOpen}
    >
      <span className="relative grid h-[22px] w-[22px] place-items-center">
        <I.refresh size={15} />
        {running && (
          <svg
            data-testid="scan-entry-ring"
            data-ring={ring.kind}
            viewBox="0 0 30 30"
            aria-hidden="true"
            className={
              ring.kind === "indeterminate"
                ? "pointer-events-none absolute inset-0 motion-safe:animate-spin"
                : "pointer-events-none absolute inset-0"
            }
          >
            <circle
              cx="15"
              cy="15"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="2"
              style={{ stroke: "var(--paper-3)" }}
            />
            <circle
              data-testid="scan-entry-ring-arc"
              cx="15"
              cy="15"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${RING_CIRCUMFERENCE}`}
              transform="rotate(-90 15 15)"
              style={{ stroke: "var(--acc)" }}
            />
          </svg>
        )}
        {unseen && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 box-content h-2 w-2 rounded-full border-2"
            style={{ background: "var(--acc)", borderColor: "var(--paper-1)" }}
          />
        )}
      </span>
      スキャン
    </button>
  );
}
