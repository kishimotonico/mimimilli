import { useRef, type ReactNode, type Ref } from "react";
import { cn } from "../lib/cn";
import Button, { buttonClass, type ButtonSize, type ButtonVariant } from "./Button";
import { I } from "./Icon";
import { MenuPopup, MotionMenuRoot, MotionMenuTrigger, useMotionMenu } from "./menu/MotionMenu";

interface SplitButtonProps {
  children: ReactNode;
  onClick: () => void;
  /** ▾のメニューの中身。`Menu.Item` などを置く */
  menu: ReactNode;
  /** 無効。`disabled` 属性は付けず（押した後にフォーカスが落ちないよう）、見た目を無効にして押しても何もしない */
  disabled?: boolean;
  /** 処理中。disabled と同じ扱い */
  busy?: boolean;
  /** 主ボタンだけを無効にする。▾のメニューは使える */
  primaryDisabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  menuLabel?: string;
  menuTriggerId?: string;
  /** 外枠の id。ポップオーバーの基準（ids.anchor）に結ぶ */
  id?: string;
  primaryRef?: Ref<HTMLButtonElement>;
  /** メニューの開閉を呼び出し側が持つ。開く要求は onMenuOpenChange(true) で届き、受け入れるまで開かない */
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  /** メニューの開く向き。既定は上（下端に置く前提）。above・belowEnd は▾の右端にそろえる。aboveStart はボタン全体の左端にそろえる（左端に置くボタンで、メニューがはみ出さないようにする） */
  placement?: keyof typeof PLACEMENT;
  className?: string;
}

const PLACEMENT = {
  above: { placement: "top-end", anchorToRoot: false },
  aboveStart: { placement: "top-start", anchorToRoot: true },
  belowEnd: { placement: "bottom-end", anchorToRoot: false },
} as const;

/** 主ボタンと▾のメニューを並べた分割ボタン。 */
export default function SplitButton({
  children,
  onClick,
  menu,
  disabled = false,
  busy = false,
  primaryDisabled = false,
  variant = "primary",
  size = "sm",
  menuLabel = "その他の操作",
  menuTriggerId,
  id,
  primaryRef,
  menuOpen,
  onMenuOpenChange,
  placement = "above",
  className,
}: SplitButtonProps) {
  const spec = PLACEMENT[placement];
  const off = disabled || busy;
  const primaryOff = off || primaryDisabled;
  const rootRef = useRef<HTMLDivElement>(null);
  const handle = useMotionMenu({
    ids: menuTriggerId === undefined ? undefined : { trigger: menuTriggerId },
    positioning: {
      placement: spec.placement,
      ...(spec.anchorToRoot && {
        getAnchorRect: () => rootRef.current?.getBoundingClientRect() ?? null,
      }),
    },
    disabled: off,
    open: menuOpen,
    onOpenChange: onMenuOpenChange && (({ open }) => onMenuOpenChange(open)),
  });
  return (
    <div ref={rootRef} id={id} className={cn("relative inline-flex", className)}>
      <MotionMenuRoot handle={handle}>
        <Button
          ref={primaryRef}
          variant={variant}
          size={size}
          softDisabled={primaryOff}
          onClick={onClick}
          className="flex-1 justify-center rounded-r-none pr-3"
        >
          {children}
        </Button>
        <MotionMenuTrigger>
          <button
            type="button"
            aria-label={menuLabel}
            className={buttonClass(variant, size, {
              disabled: off,
              className: "ml-px rounded-l-none pr-[9px] pl-[7px]",
            })}
          >
            <I.chevD size={14} />
          </button>
        </MotionMenuTrigger>
        <MenuPopup>{menu}</MenuPopup>
      </MotionMenuRoot>
    </div>
  );
}
