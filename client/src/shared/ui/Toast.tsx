import { AnimatePresence, motion } from "motion/react";
import { I } from "./Icon";
import IconButton from "./IconButton";
import Button from "./Button";

interface ToastProps {
  /** null/undefined で非表示。表示中に別のメッセージに差し替わっても違和感が出ないよう呼び出し側で管理する */
  message: string | null | undefined;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

// 単一トーストの表示専用スロット。複数同時表示のキューは今のところ不要なため持たない。
export default function Toast({ message, actionLabel, onAction, onDismiss }: ToastProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[58px] z-[45] flex justify-center">
      <AnimatePresence>
        {message && (
          <motion.output
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto flex items-center gap-2 rounded-2 border border-line-soft bg-paper-1 px-3 py-2 shadow-pop"
          >
            <span className="font-jp text-[12px] text-ink-1">{message}</span>
            {actionLabel && onAction && (
              <Button variant="ghost" onClick={onAction}>
                {actionLabel}
              </Button>
            )}
            <IconButton icon={I.x} label="閉じる" size="sm" onClick={onDismiss} />
          </motion.output>
        )}
      </AnimatePresence>
    </div>
  );
}
