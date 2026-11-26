import { useLayoutEffect } from "react";
import { useAtom } from "jotai";
import { isFocusLost } from "../../../shared/lib/focusReturnTarget";
import { focusListEntry } from "./neighborWorkId";
import { focusListOnReturnAtom } from "../model/focusListOnReturnAtom";

/**
 * 作品詳細ページで登録解除してライブラリへ戻ったとき、一覧が描画されたら一度だけ、
 * フォーカスが失われていれば決めておいた行（描画外なら roving の行、空ならコンテナ）へ移す。
 */
export function useFocusListOnReturn(isPending: boolean, workCount: number, renderedCount: number) {
  const [request, setRequest] = useAtom(focusListOnReturnAtom);
  useLayoutEffect(() => {
    if (!request || isPending || (workCount > 0 && renderedCount === 0)) return;
    setRequest(null);
    if (isFocusLost()) focusListEntry(request.neighborId);
  }, [request, isPending, workCount, renderedCount, setRequest]);
}
