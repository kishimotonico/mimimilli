import { useCallback } from "react";
import { useSetAtom, useStore } from "jotai";
import { settleLibraryFolderAtom } from "../../../entities/library/model/navigationActions";
import { libraryPlaceAtom } from "../../../entities/library/model/navigationAtoms";

/** await を挟んで保存・追加したあと、そのフォルダーへ入り直す。始めるときに呼んで場所を覚え、
 *  返した関数を完了後に呼ぶ。新規は履歴を積み、上書き（overwrite）は置き換える。始めたときと同じ画面（層なし・同じ場所）のときだけ遷移し、
 *  そうでなければ画面を動かさない */
export function useBeginSettleLibraryFolder(): () => (
  folderId: string,
  overwrite?: boolean,
) => void {
  const store = useStore();
  const settle = useSetAtom(settleLibraryFolderAtom);
  return useCallback(() => {
    const started = store.get(libraryPlaceAtom);
    return (folderId, overwrite = false) => settle(started, folderId, overwrite);
  }, [store, settle]);
}
