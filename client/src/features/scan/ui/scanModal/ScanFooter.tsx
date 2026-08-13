import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useMotionVariants } from "../../../../shared/ui/useMotionVariants";
import { I } from "../../../../shared/ui/Icon";

export interface ScanFooterProps {
  scanning: boolean;
  onCancel: () => void;
  onFullScan: () => void;
  onStart: () => void;
}

export default function ScanFooter({ scanning, onCancel, onFullScan, onStart }: ScanFooterProps) {
  return (
    <footer className="relative flex shrink-0 items-center justify-between gap-3 border-t border-line-soft px-[18px] py-3">
      <AnimatePresence initial={false}>{scanning && <ScanFooterHint key="hint" />}</AnimatePresence>
      <div className="relative flex shrink-0 items-center gap-2">
        <AnimatePresence initial={false}>
          {scanning && <ScanCancelButton key="cancel" onClick={onCancel} />}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {!scanning && <ScanFullScanButton key="fullscan" onClick={onFullScan} />}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {!scanning && <ScanStartButton key="start" onClick={onStart} />}
        </AnimatePresence>
      </div>
    </footer>
  );
}

/** フッターの「閉じてもバックグラウンドで続行します」ヒント。中止ボタンと同時に出る。 */
function ScanFooterHint() {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.div className="font-jp text-[11px] text-ink-3" inert={!isPresent} {...v}>
      閉じてもバックグラウンドで続行します
    </motion.div>
  );
}

function ScanCancelButton({ onClick }: { onClick: () => void }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      inert={!isPresent}
      {...v}
      className="inline-flex h-9 min-w-[128px] items-center justify-center gap-1.5 rounded-[6px] border border-[color-mix(in_oklch,var(--r-coral)_45%,transparent)] bg-[color-mix(in_oklch,var(--r-coral)_10%,transparent)] px-4 font-sans text-[12.5px] font-medium text-ink-0 transition-colors hover:bg-[color-mix(in_oklch,var(--r-coral)_16%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
    >
      <I.x size={12} />
      スキャンを中止
    </motion.button>
  );
}

function ScanFullScanButton({ onClick }: { onClick: () => void }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      inert={!isPresent}
      {...v}
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] border border-line-soft bg-paper-0 px-3 font-sans text-[12px] font-medium text-ink-1 transition-colors hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
    >
      <I.refresh size={12} />
      フルスキャン
    </motion.button>
  );
}

function ScanStartButton({ onClick }: { onClick: () => void }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      inert={!isPresent}
      {...v}
      className="inline-flex h-9 min-w-[128px] items-center justify-center gap-1.5 rounded-[6px] bg-ink-0 px-4 font-sans text-[12.5px] font-semibold text-paper-1 transition-colors hover:bg-acc focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
    >
      <I.refresh size={12} />
      スキャン開始
    </motion.button>
  );
}
