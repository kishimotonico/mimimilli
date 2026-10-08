// モーダルの外枠。開閉・Escape・背景クリックは useDialogModal が担い、ここは見た目と構造だけを持つ。
import type { FormEvent, ReactNode } from "react";
import { cn } from "../lib/cn";
import IconButton from "./IconButton";
import { I } from "./Icon";
import type { useDialogModal } from "./useDialogModal";

const SIZE_CLASS = {
  alert: "w-[360px] gap-2.5 p-[18px_18px_14px]",
  440: "p-0 w-[440px] max-w-[calc(100vw-32px)]",
  480: "p-0 w-[min(480px,calc(100vw-32px))]",
  520: "p-0 w-[min(520px,calc(100vw-32px))]",
  560: "p-0 w-[min(560px,calc(100vw-32px))]",
  640: "p-0 w-[min(640px,calc(100vw-32px))]",
  680: "p-0 w-[min(680px,calc(100vw-32px))]",
  720: "p-0 w-[min(720px,calc(100vw-32px))]",
  740: "p-0 w-[min(740px,calc(100vw-32px))]",
} as const;

const HEIGHT_CLASS = {
  full: "max-h-[calc(100vh-32px)]",
  short: "max-h-[min(80vh,calc(100vh-32px))]",
  editor: "max-h-[min(760px,calc(100vh-32px))]",
} as const;

export type ModalSize = keyof typeof SIZE_CLASS;

interface ModalProps {
  dialog: ReturnType<typeof useDialogModal>;
  size: ModalSize;
  height?: keyof typeof HEIGHT_CLASS;
  /** 見出しを持たないモーダルのアクセシブル名。見出しがあるときは labelledBy を使う。 */
  label?: string;
  labelledBy?: string;
  /** 背景クリックで閉じてよいか。保存中などの条件を差し込む。 */
  canBackdropClose?: () => boolean;
  /** 指定するとコンテンツ全体を form で包む。 */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

export default function Modal({
  dialog,
  size,
  height = "full",
  label,
  labelledBy,
  canBackdropClose,
  onSubmit,
  children,
}: ModalProps) {
  const isAlert = size === "alert";
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- 背景クリックはuseDialogModalで判定する。EscapeはonCancel（useDialogModal）で処理する。
    <dialog
      ref={dialog.dialogRef}
      role={isAlert ? "alertdialog" : undefined}
      aria-modal={isAlert ? true : undefined}
      aria-label={label}
      aria-labelledby={labelledBy}
      onCancel={dialog.handleCancel}
      onClick={(event) => dialog.handleBackdropClick(event, canBackdropClose)}
      className={cn(
        "m-auto flex flex-col overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 font-jp text-ink-0 shadow-pop backdrop:bg-[var(--scrim)]",
        HEIGHT_CLASS[height],
        SIZE_CLASS[size],
      )}
    >
      {onSubmit ? (
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          {children}
        </form>
      ) : (
        children
      )}
    </dialog>
  );
}

interface ModalHeaderProps {
  title: ReactNode;
  titleId: string;
  /** 見出しの上に出す小さなラベル。 */
  eyebrow?: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  closeDisabled?: boolean;
}

export function ModalHeader({
  title,
  titleId,
  eyebrow,
  icon,
  description,
  onClose,
  closeDisabled,
}: ModalHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-line-soft px-[18px] py-[14px]">
      {icon}
      <div className="min-w-0 flex-1">
        {eyebrow}
        <h2 id={titleId} className={cn("font-sans text-[14px] font-semibold", eyebrow && "mt-0.5")}>
          {title}
        </h2>
        {description}
      </div>
      {onClose && (
        <IconButton
          icon={I.x}
          label="閉じる"
          size="sm"
          disabled={closeDisabled}
          onClick={onClose}
        />
      )}
    </header>
  );
}

export function ModalFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <footer
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-line-soft px-[18px] py-3",
        className,
      )}
    >
      {children}
    </footer>
  );
}
