import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
 */
function useAutoDismissTimer(
  durationMs: number | null,
  message: string,
  onDismiss: () => void,
): { onMouseEnter: () => void; onMouseLeave: () => void; onFocus: () => void; onBlur: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(0);
  const startedAtRef = useRef(0);
  // hover と focus は独立に外れうる（キーボードでボタンにフォーカスしたままマウスだけ
  // 動かす等）。両方 false になったときだけ再開する
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);

  const clear = () => {
    if (timerRef.current == null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const schedule = (ms: number) => {
    clear();
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(onDismiss, ms);
  };

  useEffect(() => {
    if (durationMs == null) {
      clear();
      return;
    }
    remainingRef.current = durationMs;
    // message差し替え時にすでにhover/focus中なら（同一DOMノードなので再度enter/focusは
    // 発火しない）、離れるまでスケジュールしない
    if (!hoveredRef.current && !focusedRef.current) schedule(durationMs);
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDismiss は同じ効果を持つ安定した呼び出し
  }, [durationMs, message]);

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
}

function ToastContent({ message, variant, actionLabel, onAction, onDismiss }: ToastContentProps) {
  const { fadeSlideUp } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = fadeSlideUp();
  const hasAction = Boolean(actionLabel && onAction);
  const durationMs =
    variant === "error" ? null : hasAction ? TOAST_ACTION_AUTO_DISMISS_MS : TOAST_AUTO_DISMISS_MS;
  const timerHandlers = useAutoDismissTimer(durationMs, message, onDismiss);
  const VariantIcon = VARIANT_ICON[variant];
  return (
    <motion.output
      inert={!isPresent}
      {...v}
      {...timerHandlers}
      className="pointer-events-auto flex items-center gap-2 rounded-2 border border-line-soft bg-paper-1 px-3 py-2 shadow-pop"
    >
      <VariantIcon size={14} style={{ color: VARIANT_COLOR[variant] }} />
      <span className="font-jp text-[12px] text-ink-1">{message}</span>
      {hasAction && (
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
// GlobalToast）document.bodyへポータルするが、その時点で開いているモーダルdialogがあれば
// 代わりにそのdialog直下へポータルする（inert化を避け、開いている間も操作を遮らない。
// モーダルが閉じたらbodyへ戻る）。
// 呼び出し側にフラグで選ばせると既定値の選び間違いが起きうる（実際に一度回帰させた）ため、
// DOM上の宣言位置から自動導出する。
export default function Toast({
  message,
  variant = "info",
  actionLabel,
  onAction,
  onDismiss,
}: ToastProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const visible = message != null;
  // アンカーがDOMへ実際にアタッチされるまでは配置先を確定できない。未確定のまま
  // document.bodyへ倒すと、dialog内で宣言されたトーストが誤って外へ出て
  // クリック不能になりうる（TASK-327の元バグの再発）。確定するまでは何も描画しない
  // （常にmessage===nullの休眠状態からmountされるため、体感できる遅延にはならない）。
  const [anchored, setAnchored] = useState(false);
  useLayoutEffect(() => {
    setAnchored(true);
  }, []);
  const ownDialog = anchored
    ? (anchorRef.current?.closest<HTMLDialogElement>("dialog:modal") ?? null)
    : null;
  const declaredInsideDialog = ownDialog !== null;
  const topmostOpenDialog = useTopmostOpenModalDialog();
  const portalTarget = declaredInsideDialog ? ownDialog : (topmostOpenDialog ?? document.body);
  const rendersAsDialogChild = portalTarget instanceof HTMLDialogElement;

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el || !visible || !anchored || rendersAsDialogChild) return;
    syncPopoverVisibility(el, true);
  }, [visible, anchored, rendersAsDialogChild]);

  const handleExitComplete = () => {
    const el = popoverRef.current;
    if (el && !rendersAsDialogChild) syncPopoverVisibility(el, false);
  };

  return (
    <>
      {/* JSX上の宣言位置（dialog内かどうか）を実DOMから判定するための目印。見た目には影響しない */}
      <span ref={anchorRef} aria-hidden="true" style={{ display: "none" }} />
      {anchored &&
        createPortal(
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
                />
              )}
            </AnimatePresence>
          </div>,
          portalTarget,
        )}
    </>
  );
}
