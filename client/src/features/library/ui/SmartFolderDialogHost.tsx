import { useAtom, useStore } from "jotai";
import { ALL_SMART_FOLDER_ID, type SmartFolderWrite } from "@mimimilli/shared";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { closeSmartFolderDialogIfOpen, smartFolderDialogAtom } from "../model/atoms";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { useSmartFolderEditor } from "../model/useSmartFolderEditor";
import SmartFolderDialog from "./SmartFolderDialog";

/** スマートフォルダーのダイアログの唯一の描画場所。サイドバーを閉じていても出せるよう、サイドバーの外に置く */
export default function SmartFolderDialogHost() {
  const [dialog, setDialog] = useAtom(smartFolderDialogAtom);
  const store = useStore();
  const nav = useLibraryNavigation();
  const editor = useSmartFolderEditor();
  const { tagPrefixes } = useTagPrefixes();
  if (!dialog || nav.foldersStatus !== "ready") return null;
  const allSort = nav.folders.find((folder) => folder.id === ALL_SMART_FOLDER_ID)?.sort ?? null;

  const save = async (data: SmartFolderWrite) => {
    if (dialog.kind === "edit") {
      const saved = await editor.update(dialog.folder.id, data);
      if (saved) closeSmartFolderDialogIfOpen(store, dialog);
      return saved;
    }
    const created = await editor.create(data);
    if (!created) return false;
    if (closeSmartFolderDialogIfOpen(store, dialog)) nav.openFolder(created.id);
    return true;
  };

  return (
    <SmartFolderDialog
      key={
        dialog.kind === "group" || dialog.kind === "save"
          ? dialog.kind
          : `${dialog.kind}:${dialog.folder.id}`
      }
      target={dialog}
      allSort={allSort}
      tagPrefixes={tagPrefixes}
      onSave={save}
      onClose={() => setDialog(null)}
    />
  );
}
