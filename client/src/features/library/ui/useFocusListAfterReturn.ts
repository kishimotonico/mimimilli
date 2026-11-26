import { useLayoutEffect, useRef, type RefObject } from "react";
import { useAtom } from "jotai";
import type { WorkListItem } from "@mimimilli/shared";
import { isFocusLost } from "../../../shared/lib/focusReturnTarget";
import { listFocusRequestAtom } from "../model/listFocusRequestAtom";
import { focusListEntry } from "./neighborWorkId";

/**
 * 登録解除の要求を扱い、フォーカスを移すのは一覧だけにする。
 * - 作品が一覧に残っているか、詳細が選択のまま開いているあいだ（詳細が閉じる、作品詳細ページから戻る）にフォーカスが無ければ、
 *   一覧のコンテナへ預ける（body に落とさない）
 * - 作品が一覧から無くなり、行が描画された（行が無ければ空表示が出た）ら、フォーカスが無いか、退出中の詳細
 *   （data-work-detail）か預けたコンテナにあれば、隣の行（描画外なら roving の行、行が無ければコンテナ）へ移し、要求を消す
 * - 要求が失敗で取り下げられたとき、預けたコンテナにフォーカスがあれば roving の行へ戻す
 * 戻り値は、要求の間に一覧のコンテナがフォーカスを受けられるか。
 */
export function useFocusListAfterReturn(
  containerRef: RefObject<HTMLElement | null>,
  works: readonly WorkListItem[],
  selectedWorkId: string | null,
  isPending: boolean,
  renderedCount: number,
): boolean {
  const [request, setRequest] = useAtom(listFocusRequestAtom);
  const parked = useRef(false);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (request === null) {
      if (parked.current && document.activeElement === container) focusListEntry(container);
      parked.current = false;
      return;
    }
    // 詳細が選択のまま開いているあいだ（フォーカスが詳細の中に残る）は、まだ消費しない
    const present =
      selectedWorkId === request.removedId || works.some((work) => work.id === request.removedId);
    if (present || isPending || (works.length > 0 && renderedCount === 0)) {
      if (isFocusLost()) {
        container?.focus({ preventScroll: true });
        parked.current = true;
      }
      return;
    }
    const inDetail = document.activeElement?.closest("[data-work-detail]") != null;
    if (isFocusLost() || inDetail || document.activeElement === container) {
      focusListEntry(container, request.neighborId);
    }
    parked.current = false;
    setRequest(null);
  }, [containerRef, request, works, selectedWorkId, isPending, renderedCount, setRequest]);
  return request !== null;
}
