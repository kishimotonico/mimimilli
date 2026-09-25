import { useCallback, useState } from "react";
import type { SmartFolder } from "@mimimilli/shared";
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

  const saveMutation = useSmartFolderMutation({
    onSaved: (savedFolder, wasNew) => {
      setState(closedSmartFolderEditorState);
      if (wasNew) nav.setAxis(`smart-${savedFolder.id}`);
    },
    onError: () => {},
  });

  const deleteMutation = useSmartFolderDeleteMutation({
    onDeleted: () => {
      setState(closedSmartFolderEditorState);
      nav.setAxis("all");
    },
  });

  const openNew = useCallback(() => {
    saveMutation.reset();
    setState(createSmartFolderEditorState);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset系は毎レンダー新規参照のため省く
  }, []);

  const openEdit = useCallback(() => {
    if (!activeSmartFolder) return;
    saveMutation.reset();
    deleteMutation.reset();
    setState(editSmartFolderEditorState(activeSmartFolder));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset系は毎レンダー新規参照のため省く
  }, [activeSmartFolder]);

  const close = useCallback(() => setState(closedSmartFolderEditorState), []);

  return { state, openNew, openEdit, close, saveMutation, deleteMutation };
}
