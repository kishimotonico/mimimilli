import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useMotionVariants } from "./useMotionVariants";
import { useTopmostOpenModalDialog } from "./useTopmostOpenModalDialog";
import { I, type IconFC } from "./Icon";
import IconButton from "./IconButton";
import Button from "./Button";

export type ToastVariant = "info" | "success" | "warning" | "error";

/** 通常通知の既定表示寿命。action付きは操作の検討時間を確保するため長めにする */
export const TOAST_AUTO_DISMISS_MS = 5000;
export const TOAST_ACTION_AUTO_DISMISS_MS = 10000;

const VARIANT_ICON: Record<ToastVariant, IconFC> = {
  info: I.info,
  success: I.check,
  warning: I.err,
  error: I.err,
};

const VARIANT_COLOR: Record<ToastVariant, string> = {
  info: "var(--ink-2)",
  success: "var(--state-success)",
  warning: "var(--state-warning)",
  error: "var(--state-danger)",
};

interface ToastProps {
  /** null/undefined で非表示。表示中に別のメッセージに差し替わっても違和感が出ないよう呼び出し側で管理する */
  message: string | null | undefined;
  /** 種別。既定は "info"。error は自動消滅せず手動クローズのみ */
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  /** 要求ごとに一意な値。Reactのkeyとして使い、文面が同じでも別要求なら寿命タイマーを
   *  独立させる（未指定時はmessageで代用する） */
  requestKey?: string;
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

/**
 * 表示寿命タイマー。hover/focus中は一時停止し、離れたら残り時間から再開する。
 * durationMs が null（error variant）のときは何もしない＝手動クローズのみ。
 * requestKeyが変われば（文面が同じ再通知でも）別要求として寿命タイマーを取り直す。
 * onDismissは常にrefで最新を持ち、既にスケジュール済みのタイマーが発火しても
 * 古い（既に差し替わった）要求のonDismissを呼ばないようにする。
 */
function useAutoDismissTimer(
  durationMs: number | null,
  requestKey: string,
  onDismiss: () => void,
): { onMouseEnter: () => void; onMouseLeave: () => void; onFocus: () => void; onBlur: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(0);
  const startedAtRef = useRef(0);
  // hover と focus は独立に外れうる（キーボードでボタンにフォーカスしたままマウスだけ
  // 動かす等）。両方 false になったときだけ再開する
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const clear = () => {
    if (timerRef.current == null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const schedule = (ms: number) => {
    clear();
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => onDismissRef.current(), ms);
  };

  useEffect(() => {
    if (durationMs == null) {
      clear();
      return;
    }
    remainingRef.current = durationMs;
    // hover/focus中にrequestKeyだけが変わる（同じ文面の再通知）ケースは無い想定
    // （再通知は新しい要求としてGlobalToast側でhover状態ごと作り直される）
    if (!hoveredRef.current && !focusedRef.current) schedule(durationMs);
    return clear;
  }, [durationMs, requestKey]);

  const pause = () => {
    if (timerRef.current == null) return;
    remainingRef.current -= Date.now() - startedAtRef.current;
    clear();
  };
  const resume = () => {
    if (durationMs == null || timerRef.current != null) return;
    if (hoveredRef.current || focusedRef.current) return;
    schedule(Math.max(remainingRef.current, 0));
  };

  return {
    onMouseEnter: () => {
      hoveredRef.current = true;
      pause();
    },
    onMouseLeave: () => {
      hoveredRef.current = false;
      resume();
    },
    onFocus: () => {
      focusedRef.current = true;
      pause();
    },
    onBlur: () => {
      focusedRef.current = false;
      resume();
    },
  };
}

interface ToastContentProps {
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  requestKey: string;
}

function ToastContent({
  message,
  variant,
  actionLabel,
  onAction,
  onDismiss,
  requestKey,
}: ToastContentProps) {
  const { fadeSlideUp } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fadeSlideUp();
  const hasAction = Boolean(actionLabel && onAction);
  const durationMs =
    variant === "error" ? null : hasAction ? TOAST_ACTION_AUTO_DISMISS_MS : TOAST_AUTO_DISMISS_MS;
  const timerHandlers = useAutoDismissTimer(durationMs, requestKey, onDismiss);
  const VariantIcon = VARIANT_ICON[variant];
  return (
    <motion.output
      inert={!isPresent}
      {...v}
      {...timerHandlers}
      className="pointer-events-auto flex items-center gap-2 rounded-2 border border-line-soft bg-paper-1 px-3 py-2 shadow-pop"
    >
      <VariantIcon size={14} style={{ color: VARIANT_COLOR[variant] }} />
      <span className="font-jp text-body text-ink-1">{message}</span>
      {hasAction && (
        <Button variant="ghost" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      <IconButton icon={I.x} label="閉じる" size="sm" onClick={onDismiss} />
    </motion.output>
  );
}

// 単一トーストの表示専用スロット。GlobalToastだけが唯一の呼び出し元で、表示要求の
// 優先順位づけ（1件だけを選ぶ）はGlobalToast側が担う（design-system.md「単一ホストの
// 優先順位チェーン」）。showModal() の dialog より前面に出すため popover=manual で
// top layer に載せる。ただし showModal() 中の dialog はブラウザが dialog 以外の全体を
// 暗黙にinert化するため、popoverをtop layerに載せてもクリックは通らない。
// 開いているモーダルdialogがあれば useTopmostOpenModalDialog（shared/ui/）で検出し、
// 代わりにそのdialog直下へポータルしてinert化を避ける（閉じればbodyへ戻る）。
export default function Toast({
  message,
  variant = "info",
  actionLabel,
  onAction,
  onDismiss,
  requestKey,
}: ToastProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const topmostOpenDialog = useTopmostOpenModalDialog();
  const portalTarget = topmostOpenDialog ?? document.body;
  const rendersAsDialogChild = portalTarget instanceof HTMLDialogElement;

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el || message == null || rendersAsDialogChild) return;
    syncPopoverVisibility(el, true);
  }, [message, rendersAsDialogChild]);

  const handleExitComplete = () => {
    const el = popoverRef.current;
    if (el && !rendersAsDialogChild) syncPopoverVisibility(el, false);
  };

  return createPortal(
    <div
      ref={popoverRef}
      popover={rendersAsDialogChild ? undefined : "manual"}
      className="pointer-events-none fixed inset-x-0 top-[58px] m-0 w-full max-w-none flex justify-center border-none bg-transparent p-0"
    >
      <AnimatePresence onExitComplete={handleExitComplete}>
        {message != null && (
          <ToastContent
            message={message}
            variant={variant}
            actionLabel={actionLabel}
            onAction={onAction}
            onDismiss={onDismiss}
            requestKey={requestKey ?? message}
          />
        )}
      </AnimatePresence>
    </div>,
    portalTarget,
  );
}
