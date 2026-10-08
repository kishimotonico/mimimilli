import { useCallback, useState } from "react";
import { toSmartFolderAxisId, type SmartFolder } from "@mimimilli/shared";
import {
  closedSmartFolderEditorState,
  createSmartFolderEditorState,
  editSmartFolderEditorState,
  type SmartFolderEditorState,
} from "./smartFolderEditor";
import { useSmartFolderDeleteMutation, useSmartFolderMutation } from "./useLibraryQueries";
import type { LibraryViewActions, LibraryViewState } from "./useLibraryNavigation";

interface UseLibrarySmartFolderEditorOptions {
  nav: LibraryViewState & LibraryViewActions;
  activeSmartFolder: SmartFolder | null;
}

/** スマートフォルダー編集モーダルの開閉状態と保存・削除mutationをまとめる。
 *  キャッシュ更新はuseLibraryQueriesのmutation側が持つものをそのまま使い、ここでは持たない。 */
export function useLibrarySmartFolderEditor({
  nav,
  activeSmartFolder,
}: UseLibrarySmartFolderEditorOptions) {
  const [state, setState] = useState<SmartFolderEditorState>(closedSmartFolderEditorState);

  const { setAxis } = nav;
  const saveMutation = useSmartFolderMutation({
    onSaved: (savedFolder, wasNew) => {
      setState(closedSmartFolderEditorState);
      if (wasNew) setAxis(toSmartFolderAxisId(savedFolder.id));
    },
    onError: () => {},
  });

  const deleteMutation = useSmartFolderDeleteMutation({
    onDeleted: () => {
      setState(closedSmartFolderEditorState);
      setAxis("all");
    },
  });

  const { reset: resetSave } = saveMutation;
  const { reset: resetDelete } = deleteMutation;

  const openNew = useCallback(() => {
    resetSave();
    setState(createSmartFolderEditorState);
  }, [resetSave]);

  const openEdit = useCallback(() => {
    if (!activeSmartFolder) return;
    resetSave();
    resetDelete();
    setState(editSmartFolderEditorState(activeSmartFolder));
  }, [activeSmartFolder, resetSave, resetDelete]);

  const close = useCallback(() => setState(closedSmartFolderEditorState), []);

  return { state, openNew, openEdit, close, saveMutation, deleteMutation };
}
