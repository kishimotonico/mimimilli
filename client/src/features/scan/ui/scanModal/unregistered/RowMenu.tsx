import { PopupMenu, type MenuItemSpec } from "../../../../../shared/ui/Menu";
import IconButton from "../../../../../shared/ui/IconButton";
import { I } from "../../../../../shared/ui/Icon";

interface RowMenuProps {
  label: string;
  disabled: boolean;
  onOpenFolder: () => void;
  onExclude: () => void;
}

/** 行の右端の︙メニュー。 */
export default function RowMenu({ label, disabled, onOpenFolder, onExclude }: RowMenuProps) {
  const items: MenuItemSpec[] = [
    { key: "open-folder", label: "フォルダーを開く", onSelect: onOpenFolder },
    { key: "exclude", label: "除外", onSelect: onExclude, danger: true },
  ];
  return (
    <PopupMenu items={items} placement="belowEnd" closeOnScroll closeOnFocusOut>
      {(trigger) => (
        <IconButton
          icon={I.moreV}
          label={label}
          size="sm"
          tone="muted"
          disabled={disabled}
          {...trigger}
        />
      )}
    </PopupMenu>
  );
}
