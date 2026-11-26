import { Menu } from "@ark-ui/react/menu";
import { useAtomValue } from "jotai";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { useToast } from "../../../shared/ui/useToast";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { MenuPopup, MotionMenuRoot, useMotionMenu } from "../../../shared/ui/menu/MotionMenu";
import { MENU_GUTTER, MENU_LABEL_CLASS, menuItemClass } from "../../../shared/ui/menu/menuStyles";
import { useRootFolder } from "../../../entities/settings/useSettingsQuery";
import { filesRelPathAtom } from "../../../entities/file-system/model/navigationAtoms";
import { joinPath } from "../model/types";

/** アドレスバー右端の「その他」メニュー（Filesモード限定）。今いるフォルダーの絶対パスコピーを提供する。 */
export default function FilesAddressBarMenu() {
  const rootFolder = useRootFolder();
  const relPath = useAtomValue(filesRelPathAtom);
  const toast = useToast();

  const menu = useMotionMenu({ positioning: { placement: "bottom-end", gutter: MENU_GUTTER } });

  const copyCurrentFolderPath = async () => {
    const path = joinPath(rootFolder, relPath);
    try {
      await navigator.clipboard.writeText(path);
      toast.show({ message: "絶対パスをコピーしました", variant: "success", priority: "notice" });
    } catch (cause) {
      toast.error(apiErrorMessage(cause, "パスのコピーに失敗しました"));
    }
  };

  return (
    <MotionMenuRoot handle={menu}>
      <Menu.Trigger asChild>
        <IconButton size="sm" icon={I.more} label="その他" active={menu.menu.api.open} />
      </Menu.Trigger>
      <MenuPopup origin="top right">
        <Menu.Item value="copy-path" onSelect={copyCurrentFolderPath} className={menuItemClass()}>
          <span className={MENU_LABEL_CLASS}>絶対パスをコピー</span>
        </Menu.Item>
      </MenuPopup>
    </MotionMenuRoot>
  );
}
