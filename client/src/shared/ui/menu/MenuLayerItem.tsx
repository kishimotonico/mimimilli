import { useContext, type ComponentProps } from "react";
import { Menu } from "@ark-ui/react/menu";
import { CloseWithoutRestoreContext } from "./MotionMenu";

/**
 * 別の層（ダイアログ、ポップオーバー）を開く項目。メニューはフォーカスをトリガーへ戻さずに閉じる
 * （開いた層の初期フォーカスを奪わないため）。開いた層が閉じたときの戻し先はメニューのトリガーにする。
 */
export function MenuLayerItem({ onSelect, ...props }: ComponentProps<typeof Menu.Item>) {
  const close = useContext(CloseWithoutRestoreContext);
  return (
    <Menu.Item
      {...props}
      closeOnSelect={false}
      onSelect={() => {
        close?.();
        onSelect?.();
      }}
    />
  );
}
