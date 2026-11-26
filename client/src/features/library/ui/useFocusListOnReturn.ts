import { useLayoutEffect } from "react";
import { useAtom } from "jotai";
import { isFocusLost } from "../../../shared/lib/focusReturnTarget";
import { focusListEntry } from "./neighborWorkId";
import { focusListOnReturnAtom } from "../model/focusListOnReturnAtom";

/**
 * 作品詳細ページで登録解除してライブラリへ戻ったとき、一覧が描画されたら一度だけ、
 * フォーカスが失われていれば roving の行（空ならコンテナ）へ移す。
 */
export function useFocusListOnReturn(isPending: boolean, workCount: number, renderedCount: number) {
  const [requested, setRequested] = useAtom(focusListOnReturnAtom);
  useLayoutEffect(() => {
    if (!requested || isPending || (workCount > 0 && renderedCount === 0)) return;
    setRequested(false);
    if (isFocusLost()) focusListEntry();
  }, [requested, isPending, workCount, renderedCount, setRequested]);
}
