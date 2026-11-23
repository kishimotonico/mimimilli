import { useAtom } from "jotai";
import { ALL_SMART_FOLDER_ID, type SmartFolderWrite } from "@mimimilli/shared";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { smartFolderDialogAtom } from "../model/atoms";
import { useBeginSettleLibraryFolder } from "../model/useSettleLibraryFolder";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { useSmartFolderEditor } from "../model/useSmartFolderEditor";
import SmartFolderDialog from "./SmartFolderDialog";

/** スマートフォルダーのダイアログの唯一の描画場所。サイドバーを閉じていても出せるよう、サイドバーの外に置く */
export default function SmartFolderDialogHost() {
  const [dialog, setDialog] = useAtom(smartFolderDialogAtom);
  const beginSettle = useBeginSettleLibraryFolder();
  const nav = useLibraryNavigation();
  const editor = useSmartFolderEditor();
  const { tagPrefixes } = useTagPrefixes();
  if (!dialog || nav.foldersStatus !== "ready") return null;
  const allSort = nav.folders.find((folder) => folder.id === ALL_SMART_FOLDER_ID)?.sort;
  if (!allSort) throw new Error("「すべて」の既定の並びがありません");

  const save = async (data: SmartFolderWrite) => {
    if (dialog.kind === "edit") {
      const saved = await editor.update(dialog.folder.id, data);
      if (saved) setDialog(null);
      return saved;
    }
    const settle = beginSettle();
    const created = await editor.create(data);
    if (!created) return false;
    setDialog(null);
    settle(created.id);
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
