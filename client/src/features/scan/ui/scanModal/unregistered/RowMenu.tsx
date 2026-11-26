import { Menu } from "@ark-ui/react/menu";
import IconButton from "../../../../../shared/ui/IconButton";
import { I } from "../../../../../shared/ui/Icon";
import { MenuPopup, MotionMenuRoot, useMotionMenu } from "../../../../../shared/ui/menu/MotionMenu";
import {
  MENU_GUTTER,
  MENU_LABEL_CLASS,
  MENU_SEPARATOR_CLASS,
  menuItemClass,
} from "../../../../../shared/ui/menu/menuStyles";

interface RowMenuProps {
  label: string;
  disabled: boolean;
  onOpenFolder: () => void;
  onExclude: () => void;
}

/** 行の右端の︙メニュー。 */
export default function RowMenu({ label, disabled, onOpenFolder, onExclude }: RowMenuProps) {
  const menu = useMotionMenu({ positioning: { placement: "bottom-end", gutter: MENU_GUTTER } });
  return (
    <MotionMenuRoot handle={menu}>
      <Menu.Trigger asChild>
        <IconButton icon={I.moreV} label={label} size="sm" tone="muted" disabled={disabled} />
      </Menu.Trigger>
      <MenuPopup origin="top right">
        <Menu.Item value="open-folder" onSelect={onOpenFolder} className={menuItemClass()}>
          <span className={MENU_LABEL_CLASS}>フォルダーを開く</span>
        </Menu.Item>
        <Menu.Separator className={MENU_SEPARATOR_CLASS} />
        <Menu.Item value="exclude" onSelect={onExclude} className={menuItemClass({ danger: true })}>
          <span className={MENU_LABEL_CLASS}>除外</span>
        </Menu.Item>
      </MenuPopup>
    </MotionMenuRoot>
  );
}
