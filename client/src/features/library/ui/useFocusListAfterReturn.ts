import { useLayoutEffect } from "react";
import { useAtom } from "jotai";
import type { WorkListItem } from "@mimimilli/shared";
import { isFocusLost } from "../../../shared/lib/focusReturnTarget";
import { listFocusRequestAtom } from "../model/listFocusRequestAtom";
import { focusListEntry } from "./neighborWorkId";

/**
 * 登録解除した作品の要求を扱う。
 * - 作品詳細ページから戻って一覧が描画され、フォーカスが無ければ、まず一覧のコンテナへ預ける
 *   （作品が一覧から消えるのを待つあいだ body に落とさない）
 * - 作品が一覧から無くなり、行が描画された（行が無ければ空表示が出た）ら、フォーカスが無いか
 *   コンテナにあれば一覧の入口（roving の行、無ければコンテナ）へ移し、要求を消す
 * 戻り値は、要求の間に一覧のコンテナがフォーカスを受けられるか。
 */
export function useFocusListAfterReturn(
  works: readonly WorkListItem[],
  isPending: boolean,
  renderedCount: number,
): boolean {
  const [removedId, setRemovedId] = useAtom(listFocusRequestAtom);
  useLayoutEffect(() => {
    if (removedId === null) return;
    const container = document.querySelector<HTMLElement>("[data-work-list]");
    const present = works.some((work) => work.id === removedId);
    if (present || isPending || (works.length > 0 && renderedCount === 0)) {
      if (isFocusLost()) container?.focus({ preventScroll: true });
      return;
    }
    if (isFocusLost() || document.activeElement === container) focusListEntry();
    setRemovedId(null);
  }, [removedId, works, isPending, renderedCount, setRemovedId]);
  return removedId !== null;
}
