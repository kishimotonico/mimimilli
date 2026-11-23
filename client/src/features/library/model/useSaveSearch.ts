// 今の絞り込みの保存の操作（検索を保存・上書き）。チップ列と＋メニューが使う。

import { useCallback, useRef } from "react";
import { useSetAtom } from "jotai";
import { useToast } from "../../../shared/ui/useToast";
import { smartFolderDialogAtom } from "./atoms";
import {
  isOverwritable,
  overwriteChange,
  overwriteUndoChange,
  saveOffer,
  saveDialogTarget,
  type SaveOffer,
} from "./saveSearch";
import type { ResolvedLibraryView } from "../../../entities/library/resolveLibraryView";
import type { LibraryViewActions, LibraryViewState } from "./useLibraryNavigation";
import { useSmartFolderEditor } from "./useSmartFolderEditor";

export interface SaveSearchActions {
  offer: SaveOffer | null;
  /** 「検索を保存」「別名で保存」。名前を入れるダイアログを開く */
  openSaveDialog: () => void;
  /** 「〇〇を上書き」。成功したらトーストの「元に戻す」で上書き前へ戻せる */
  overwrite: () => Promise<void>;
}

/** 「検索を保存」「別名で保存」。名前を入れるダイアログを開く */
export function useOpenSaveDialog(view: ResolvedLibraryView | null): () => void {
  const setDialog = useSetAtom(smartFolderDialogAtom);
  return useCallback(() => {
    if (view) setDialog(saveDialogTarget(view));
  }, [view, setDialog]);
}

export function useSaveSearch(nav: LibraryViewState & LibraryViewActions): SaveSearchActions {
  const view = nav.foldersStatus === "ready" ? nav.view : null;
  const editor = useSmartFolderEditor();
  const toast = useToast();
  const openSaveDialog = useOpenSaveDialog(view);
  const overwriting = useRef(false);

  const overwrite = useCallback(async () => {
    if (view?.kind !== "works" || !isOverwritable(view)) return;
    if (overwriting.current) return;
    overwriting.current = true;
    const { folder } = view;
    const undoChange = overwriteUndoChange(view);
    const saved = await editor.patch(folder.id, overwriteChange(view), {
      failureMessage: "スマートフォルダーを上書きできませんでした",
      reenter: true,
    });
    overwriting.current = false;
    if (!saved) return;
    let undone = false;
    toast.show({
      message: `「${folder.name}」を上書きしました`,
      variant: "success",
      actionLabel: "元に戻す",
      onAction: () => {
        if (undone) return;
        undone = true;
        toast.dismiss();
        void editor.patch(folder.id, undoChange, { failureMessage: "元に戻せませんでした" });
      },
      priority: "action",
      dismissOnUnmount: false,
    });
  }, [view, editor, toast]);

  return { offer: view ? saveOffer(view) : null, openSaveDialog, overwrite };
}
