import type { ReactNode } from "react";
import { Menu } from "@ark-ui/react/menu";
import { cn } from "../lib/cn";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./Button";
import { I } from "./Icon";
import { MenuPopup, MotionMenuRoot, useMotionMenu } from "./menu/MotionMenu";
import { MENU_GUTTER } from "./menu/menuStyles";

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
  /** メニューの開く向き。既定は上（下端に置く前提） */
  placement?: "above" | "belowEnd";
  className?: string;
}

const PLACEMENT = {
  above: { placement: "top-end", origin: "bottom right" },
  belowEnd: { placement: "bottom-end", origin: "top right" },
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
  placement = "above",
  className,
}: SplitButtonProps) {
  const spec = PLACEMENT[placement];
  const off = disabled || busy;
  const primaryOff = off || primaryDisabled;
  const handle = useMotionMenu({
    positioning: { placement: spec.placement, gutter: MENU_GUTTER },
    disabled: off,
  });
  return (
    <div className={cn("relative inline-flex", className)}>
      <MotionMenuRoot handle={handle}>
        <button
          type="button"
          aria-disabled={primaryOff || undefined}
          onClick={() => {
            if (!primaryOff) onClick();
          }}
          className={buttonClass(variant, size, {
            disabled: primaryOff,
            className: "flex-1 justify-center rounded-r-none pr-3",
          })}
        >
          {children}
        </button>
        <Menu.Trigger asChild {...handle.triggerProps}>
          <button
            type="button"
            aria-disabled={off || undefined}
            aria-label={menuLabel}
            className={buttonClass(variant, size, {
              disabled: off,
              className: "ml-px rounded-l-none pr-[9px] pl-[7px]",
            })}
          >
            <I.chevD size={14} />
          </button>
        </Menu.Trigger>
        <MenuPopup origin={spec.origin}>{menu}</MenuPopup>
      </MotionMenuRoot>
    </div>
  );
}
