import { Menu } from "@ark-ui/react/menu";
import { I } from "../Icon";
import { MENU_CHECK_COLUMN_CLASS } from "./menuStyles";

/** チェック・ラジオ項目を持つメニューで、全項目の先頭に置く列。選択中の項目だけチェックを出す */
export function MenuCheckColumn() {
  return (
    <span aria-hidden="true" className={MENU_CHECK_COLUMN_CLASS}>
      <Menu.ItemIndicator>
        <I.check size={12} />
      </Menu.ItemIndicator>
    </span>
  );
}
