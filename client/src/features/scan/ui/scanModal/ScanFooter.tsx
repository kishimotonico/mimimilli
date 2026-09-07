import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useMotionVariants } from "../../../../shared/ui/useMotionVariants";
import { buttonClass } from "../../../../shared/ui/Button";
import { I } from "../../../../shared/ui/Icon";

export interface ScanFooterProps {
  scanning: boolean;
  /** 前回スキャン結果が表示されているか（主ボタンの文言を「スキャン」「再スキャン」で切り替える） */
  hasResult: boolean;
  onCancel: () => void;
  onFullScan: () => void;
  onStart: () => void;
}

export default function ScanFooter({
  scanning,
  hasResult,
  onCancel,
  onFullScan,
  onStart,
}: ScanFooterProps) {
  return (
    <footer className="relative flex shrink-0 items-center justify-between gap-3 border-t border-line-soft px-[18px] py-3">
      <AnimatePresence initial={false}>
        {scanning ? <ScanFooterHint key="hint" /> : <ScanDiffHint key="diff" />}
      </AnimatePresence>
      <div className="relative flex shrink-0 items-center gap-3">
        <AnimatePresence initial={false}>
          {scanning && <ScanCancelButton key="cancel" onClick={onCancel} />}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {!scanning && <ScanFullScanLink key="fullscan" onClick={onFullScan} />}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {!scanning && <ScanStartButton key="start" hasResult={hasResult} onClick={onStart} />}
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
    <motion.p className="m-0 font-jp text-secondary text-ink-2" inert={!isPresent} {...v}>
      閉じてもバックグラウンドで続行します
    </motion.p>
  );
}

/** フッターの差分スキャン説明。「すべて読み直す」との違いを言葉で示す。 */
function ScanDiffHint() {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.p className="m-0 font-jp text-secondary text-ink-2" inert={!isPresent} {...v}>
      変更のあったフォルダーだけを調べます
    </motion.p>
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
      className={buttonClass("danger", "lg", { className: "min-w-[128px] justify-center" })}
    >
      <I.x size={12} />
      スキャンを中止
    </motion.button>
  );
}

function ScanFullScanLink({ onClick }: { onClick: () => void }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      inert={!isPresent}
      {...v}
      className="font-sans text-body font-medium text-ink-2 underline-offset-2 transition-colors hover:text-ink-0 hover:underline"
    >
      すべて読み直す
    </motion.button>
  );
}

function ScanStartButton({ hasResult, onClick }: { hasResult: boolean; onClick: () => void }) {
  const { fade } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fade();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      inert={!isPresent}
      {...v}
      className={buttonClass("primary", "lg", { className: "min-w-[128px] justify-center" })}
    >
      <I.refresh size={12} />
      {hasResult ? "再スキャン" : "スキャン"}
    </motion.button>
  );
}
