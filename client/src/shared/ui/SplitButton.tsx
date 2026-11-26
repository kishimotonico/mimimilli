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
  disabled?: boolean;
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
  primaryDisabled = false,
  variant = "primary",
  size = "sm",
  menuLabel = "その他の操作",
  placement = "above",
  className,
}: SplitButtonProps) {
  const spec = PLACEMENT[placement];
  const handle = useMotionMenu({ positioning: { placement: spec.placement, gutter: MENU_GUTTER } });
  return (
    <div className={cn("relative inline-flex", className)}>
      <MotionMenuRoot handle={handle}>
        <button
          type="button"
          disabled={disabled || primaryDisabled}
          onClick={onClick}
          className={buttonClass(variant, size, {
            disabled: disabled || primaryDisabled,
            className: "flex-1 justify-center rounded-r-none pr-3",
          })}
        >
          {children}
        </button>
        <Menu.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={menuLabel}
            className={buttonClass(variant, size, {
              disabled,
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
