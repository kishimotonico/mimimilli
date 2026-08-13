import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useMotionVariants } from "./useMotionVariants";
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

function syncPopoverVisibility(el: HTMLElement, visible: boolean) {
  if (!("showPopover" in el)) return;
  try {
    if (visible) el.showPopover();
    else el.hidePopover();
  } catch {
    // 既に同じ状態のとき hidePopover / showPopover は DOMException になる
  }
}

interface ToastContentProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

function ToastContent({ message, actionLabel, onAction, onDismiss }: ToastContentProps) {
  const { fadeSlideUp } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fadeSlideUp();
  return (
    <motion.output
      inert={!isPresent}
      {...v}
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
  );
}

// 単一トーストの表示専用スロット。複数同時表示のキューは今のところ不要なため持たない。
// showModal() の dialog より前面に出すため popover=manual で top layer に載せる（design-system.md）。
// ただし showModal() 中の dialog はブラウザが dialog 以外の全体を暗黙にinert化するため、
// popoverをtop layerに載せてもクリックは通らない（TASK-327で実測）。
//
// <Toast> がJSX上どこで宣言されているかで挙動を自動的に決める。開いているdialogの中で
// 宣言されていれば（例: ScanModalが自分のJSX内で描くトースト）そのdialog自身の配下へ
// ポータルし、通常の子要素としてinert化の対象から外す（dialogが閉じるとトーストも消える —
// そのdialogに属する通知なので正しい）。dialogの外で宣言されていれば（例: アプリルートの
// GlobalToast）従来どおりdocument.bodyへポータルする（どのdialogとも無関係なため、
// たまたま開いているdialogの開閉に巻き込まれず表示が続く）。
// 呼び出し側にフラグで選ばせると既定値の選び間違いが起きうる（実際に一度回帰させた）ため、
// DOM上の宣言位置から自動導出する。
export default function Toast({ message, actionLabel, onAction, onDismiss }: ToastProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const visible = message != null;
  // アンカーは初回マウント時点では未commitでnullだが、その時点では常にmessage===null
  // （表示するものが無い）なので実害はない。以降の再描画では直前のcommitで既に
  // アタッチ済みのため、レンダー中に読んでも1フレーム遅れて配置先が切り替わる
  // （=一瞬だけ間違った位置に出る）ことはない。
  const ownerDialog = anchorRef.current?.closest<HTMLDialogElement>("dialog:modal") ?? null;
  const insideDialog = ownerDialog !== null;

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el || !visible || insideDialog) return;
    syncPopoverVisibility(el, true);
  }, [visible, insideDialog]);

  const handleExitComplete = () => {
    const el = popoverRef.current;
    if (el && !insideDialog) syncPopoverVisibility(el, false);
  };

  return (
    <>
      {/* JSX上の宣言位置（dialog内かどうか）を実DOMから判定するための目印。見た目には影響しない */}
      <span ref={anchorRef} aria-hidden="true" style={{ display: "none" }} />
      {createPortal(
        <div
          ref={popoverRef}
          popover={insideDialog ? undefined : "manual"}
          className="pointer-events-none fixed inset-x-0 top-[58px] m-0 flex justify-center border-none bg-transparent p-0"
        >
          <AnimatePresence onExitComplete={handleExitComplete}>
            {message != null && (
              <ToastContent
                message={message}
                actionLabel={actionLabel}
                onAction={onAction}
                onDismiss={onDismiss}
              />
            )}
          </AnimatePresence>
        </div>,
        ownerDialog ?? document.body,
      )}
    </>
  );
}
