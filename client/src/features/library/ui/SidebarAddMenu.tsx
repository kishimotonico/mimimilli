import { Menu } from "@ark-ui/react/menu";
import { MenuLayerItem } from "../../../shared/ui/menu/MenuLayerItem";
import type { SmartFolderTemplate } from "@mimimilli/shared";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { MenuPopup, MotionMenuRoot, useMotionMenu } from "../../../shared/ui/menu/MotionMenu";
import {
  MENU_GUTTER,
  MENU_HEADING_CLASS,
  MENU_LABEL_CLASS,
  MENU_SEPARATOR_CLASS,
  menuItemClass,
} from "../../../shared/ui/menu/menuStyles";

interface SidebarAddMenuProps {
  /** 絞り込みが無いときの「複製」の対象。無ければ出さない */
  duplicateName: string | null;
  /** 絞り込みがあるときの「今の検索を保存」。出すときは複製の代わりになる */
  canSaveSearch: boolean;
  templates: SmartFolderTemplate[];
  onDuplicate: () => void;
  onSaveSearch: () => void;
  onAddGroup: () => void;
  onAddTemplate: (templateId: string) => void;
}

/** 見出しの ＋ とそのメニュー */
export default function SidebarAddMenu({
  duplicateName,
  canSaveSearch,
  templates,
  onDuplicate,
  onSaveSearch,
  onAddGroup,
  onAddTemplate,
}: SidebarAddMenuProps) {
  const menu = useMotionMenu({ positioning: { placement: "bottom-end", gutter: MENU_GUTTER } });
  return (
    <MotionMenuRoot handle={menu}>
      <Menu.Trigger asChild>
        <IconButton icon={I.add} label="追加" size="xs" tone="muted" active={menu.menu.api.open} />
      </Menu.Trigger>
      <MenuPopup origin="top right">
        {canSaveSearch && (
          <MenuLayerItem
            value="save-search"
            valueText="今の検索を保存"
            onSelect={onSaveSearch}
            className={menuItemClass()}
          >
            <span className={MENU_LABEL_CLASS}>今の検索を保存</span>
          </MenuLayerItem>
        )}
        {!canSaveSearch && duplicateName !== null && (
          <MenuLayerItem
            value="duplicate"
            valueText={`「${duplicateName}」を複製`}
            onSelect={onDuplicate}
            className={menuItemClass()}
          >
            <span className={MENU_LABEL_CLASS}>{`「${duplicateName}」を複製`}</span>
          </MenuLayerItem>
        )}
        <MenuLayerItem
          value="add-group"
          valueText="グループ分けを追加"
          onSelect={onAddGroup}
          className={menuItemClass()}
        >
          <span className={MENU_LABEL_CLASS}>グループ分けを追加</span>
        </MenuLayerItem>
        <Menu.Separator className={MENU_SEPARATOR_CLASS} />
        <Menu.ItemGroup>
          <Menu.ItemGroupLabel className={MENU_HEADING_CLASS}>既定から追加</Menu.ItemGroupLabel>
          {templates.length > 0 ? (
            templates.map((template) => (
              <Menu.Item
                key={template.id}
                value={template.id}
                valueText={template.name}
                onSelect={() => onAddTemplate(template.id)}
                className={menuItemClass()}
              >
                <span className={MENU_LABEL_CLASS}>{template.name}</span>
              </Menu.Item>
            ))
          ) : (
            <div className="px-2 pt-1 pb-1.5 text-ink-3">すべて追加済み</div>
          )}
        </Menu.ItemGroup>
      </MenuPopup>
    </MotionMenuRoot>
  );
}
