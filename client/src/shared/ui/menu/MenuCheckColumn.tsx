import { Menu } from "@ark-ui/react/menu";
import { I } from "../Icon";
import { MENU_CHECK_COLUMN_CLASS } from "./menuStyles";

/** ラジオ・チェック項目（Menu.RadioItem など）の先頭に置く列。選択中だけチェックを出す */
export function MenuCheckColumn() {
  return (
    <span aria-hidden="true" className={MENU_CHECK_COLUMN_CLASS}>
      <Menu.ItemIndicator>
        <I.check size={12} />
      </Menu.ItemIndicator>
    </span>
  );
}

/** 同じメニューの普通の項目（Menu.Item）に置く、印を持たない列。ラベルの位置をそろえる */
export function MenuCheckSpacer() {
  return <span aria-hidden="true" className={MENU_CHECK_COLUMN_CLASS} />;
}
