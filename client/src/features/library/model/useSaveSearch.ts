// 今の絞り込みの保存の操作（検索を保存・上書き）。チップ列と＋メニューが使う。

import { useCallback, useRef } from "react";
import { useSetAtom } from "jotai";
import { useToast } from "../../../shared/ui/useToast";
import { smartFolderDialogAtom } from "./atoms";
import {
  isOverwritable,
  overwriteWrite,
  saveOffer,
  saveDialogTarget,
  type OverwritableFolder,
  type SaveOffer,
} from "./saveSearch";
import { draftOf, toWrite } from "./smartFolderEditing";
import type { LibraryViewActions, LibraryViewState } from "./useLibraryNavigation";
import { useSmartFolderEditor } from "./useSmartFolderEditor";

export interface SaveSearchActions {
  offer: SaveOffer | null;
  /** 「検索を保存」「別名で保存」。名前を入れるダイアログを開く */
  openSaveDialog: () => void;
  /** 「〇〇を上書き」。成功したらトーストの「元に戻す」で上書き前へ戻せる */
  overwrite: () => Promise<void>;
}

export function useSaveSearch(nav: LibraryViewState & LibraryViewActions): SaveSearchActions {
  const view = nav.foldersStatus === "ready" ? nav.view : null;
  const { openFolder } = nav;
  const editor = useSmartFolderEditor();
  const toast = useToast();
  const setDialog = useSetAtom(smartFolderDialogAtom);
  const overwriting = useRef(false);

  const openSaveDialog = useCallback(() => {
    if (view?.kind === "works") setDialog(saveDialogTarget(view));
  }, [view, setDialog]);

  const overwrite = useCallback(async () => {
    if (view?.kind !== "works" || !isOverwritable(view)) return;
    if (overwriting.current) return;
    overwriting.current = true;
    const folder = view.folder as OverwritableFolder;
    const before = toWrite(draftOf(folder));
    const saved = await editor.update(folder.id, overwriteWrite({ ...view, folder }));
    overwriting.current = false;
    if (!saved) return;
    openFolder(folder.id);
    let undone = false;
    toast.show({
      message: `「${folder.name}」を上書きしました`,
      variant: "success",
      actionLabel: "元に戻す",
      onAction: () => {
        if (undone) return;
        undone = true;
        toast.dismiss();
        void editor.update(folder.id, before, "元に戻せませんでした");
      },
      priority: "action",
      dismissOnUnmount: false,
    });
  }, [view, editor, openFolder, toast]);

  return { offer: view ? saveOffer(view) : null, openSaveDialog, overwrite };
}
