import { useState } from "react";
import { useAtomValue } from "jotai";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { useToast } from "../../../shared/ui/useToast";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import {
  useAnchoredPopover,
  type PopoverContainerResolver,
} from "../../../shared/ui/useAnchoredPopover";
import { useRootFolder } from "../../../entities/settings/useSettingsQuery";
import { filesRelPathAtom } from "../../../entities/file-system/model/navigationAtoms";
import { joinPath } from "../model/types";

const MENU_POPOVER_WIDTH = 200;

// アドレスバーはプレビューパネル(.mle-prv__body)の外にあるため、既定のコンテナ解決を
// 使わずビューポート基準のclippingAncestorsに委ねる。
const addressBarPopoverContainerResolver: PopoverContainerResolver = () => null;

/** アドレスバー右端の「その他」メニュー（Filesモード限定）。今いるフォルダーの絶対パスコピーを提供する。 */
export default function FilesAddressBarMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const rootFolder = useRootFolder();
  const relPath = useAtomValue(filesRelPathAtom);
  const toast = useToast();

  const { setReference, setFloating, floatingStyles, close } = useAnchoredPopover({
    isOpen,
    preferredWidth: MENU_POPOVER_WIDTH,
    getContainer: addressBarPopoverContainerResolver,
    onClose: () => setIsOpen(false),
  });

  const copyCurrentFolderPath = async () => {
    close();
    if (!rootFolder) return;
    const path = joinPath(rootFolder, relPath);
    try {
      await navigator.clipboard.writeText(path);
      toast.show({ message: "絶対パスをコピーしました", variant: "success", priority: "notice" });
    } catch (cause) {
      toast.error(apiErrorMessage(cause, "パスのコピーに失敗しました"));
    }
  };

  return (
    <div ref={setReference} className="relative inline-flex">
      <IconButton
        size="sm"
        icon={I.more}
        label="その他"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        active={isOpen}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
      />
      {isOpen && (
        <div
          ref={setFloating}
          className="absolute z-10 rounded-[6px] border border-line-soft bg-paper-1 p-1 shadow-pop"
          style={floatingStyles}
        >
          <div className="flex flex-col gap-1" role="menu">
            <button
              type="button"
              role="menuitem"
              className="flex min-h-7 w-full items-center gap-2 rounded-1 px-2 font-jp text-body text-ink-1 hover:bg-paper-2 hover:text-ink-0 focus:bg-paper-2"
              onClick={copyCurrentFolderPath}
            >
              <I.copy size={13} />
              <span className="min-w-0 flex-1 truncate">絶対パスをコピー</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
