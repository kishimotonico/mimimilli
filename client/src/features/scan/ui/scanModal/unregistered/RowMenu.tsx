import { Menu } from "@ark-ui/react/menu";
import IconButton from "../../../../../shared/ui/IconButton";
import { I } from "../../../../../shared/ui/Icon";
import {
  MenuPopup,
  MotionMenuRoot,
  MotionMenuTrigger,
  useMotionMenu,
} from "../../../../../shared/ui/menu/MotionMenu";
import {
  MENU_LABEL_CLASS,
  MENU_SEPARATOR_CLASS,
  menuItemClass,
} from "../../../../../shared/ui/menu/menuStyles";

interface RowMenuProps {
  label: string;
  /** 処理中。トリガーはフォーカスを残したまま開かなくし、項目も無効にする */
  busy: boolean;
  onOpenFolder: () => void;
  onExclude: () => void;
}

/** 行の右端の︙メニュー。 */
export default function RowMenu({ label, busy, onOpenFolder, onExclude }: RowMenuProps) {
  const menu = useMotionMenu({
    positioning: { placement: "bottom-end" },
    disabled: busy,
  });
  return (
    <MotionMenuRoot handle={menu}>
      <MotionMenuTrigger>
        <IconButton icon={I.moreV} label={label} size="sm" tone="muted" />
      </MotionMenuTrigger>
      <MenuPopup>
        <Menu.Item
          value="open-folder"
          valueText="フォルダーを開く"
          disabled={busy}
          onSelect={onOpenFolder}
          className={menuItemClass()}
        >
          <span className={MENU_LABEL_CLASS}>フォルダーを開く</span>
        </Menu.Item>
        <Menu.Separator className={MENU_SEPARATOR_CLASS} />
        <Menu.Item
          value="exclude"
          valueText="除外"
          disabled={busy}
          onSelect={onExclude}
          className={menuItemClass({ danger: true })}
        >
          <span className={MENU_LABEL_CLASS}>除外</span>
        </Menu.Item>
      </MenuPopup>
    </MotionMenuRoot>
  );
}
