import { Fragment, useLayoutEffect, useRef, type ReactNode } from "react";
import { Menu } from "@ark-ui/react/menu";
import { cn } from "../lib/cn";
import { MenuPopup, MotionMenuRoot, useMotionMenu } from "./menu/MotionMenu";
import {
  MENU_COUNT_CLASS,
  MENU_GUTTER,
  MENU_LABEL_CLASS,
  MENU_SEPARATOR_CLASS,
  menuItemClass,
} from "./menu/menuStyles";

export interface MenuItemSpec {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** 破壊的な操作。赤で出し、区切り線の下に置く */
  danger?: boolean;
  /** 右端に添える件数などの補足。名前には含めない */
  trailing?: ReactNode;
}

interface PopupMenuProps {
  items: readonly MenuItemSpec[];
  /** メニューの開く向き。above は上向き、belowEnd は下向きでトリガーの右端にそろえる */
  placement: "above" | "belowEnd";
  /** トリガーを置く領域に付ける */
  className?: string;
  /** トリガーのボタンを `<Menu.Trigger asChild>` で包んで描く */
  children: ReactNode;
}

const PLACEMENT = {
  above: { placement: "top-end", origin: "bottom right" },
  belowEnd: { placement: "bottom-end", origin: "top right" },
} as const;

/**
 * 項目の配列を受けるボタン起点のメニュー。トリガーは呼び出し側が描く。
 * 所属するダイアログがあればその中へ出す。
 */
export function PopupMenu({ items, placement, className, children }: PopupMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    containerRef.current = rootRef.current?.closest("dialog") ?? null;
  });
  const spec = PLACEMENT[placement];
  const handle = useMotionMenu({
    positioning: { placement: spec.placement, gutter: MENU_GUTTER },
  });
  const firstDangerIndex = items.findIndex((item) => item.danger);

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <MotionMenuRoot handle={handle}>
        {children}
        <MenuPopup container={containerRef} origin={spec.origin}>
          {items.map((item, index) => (
            <Fragment key={item.key}>
              {index === firstDangerIndex && index > 0 && (
                <Menu.Separator className={MENU_SEPARATOR_CLASS} />
              )}
              <Menu.Item
                value={item.key}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={menuItemClass({ danger: item.danger })}
              >
                <span className={MENU_LABEL_CLASS}>{item.label}</span>
                {item.trailing !== undefined && (
                  <span aria-hidden="true" className={MENU_COUNT_CLASS}>
                    {item.trailing}
                  </span>
                )}
              </Menu.Item>
            </Fragment>
          ))}
        </MenuPopup>
      </MotionMenuRoot>
    </div>
  );
}
