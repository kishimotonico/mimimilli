import { isFocusLost } from "../../../shared/lib/isFocusLost";

/** 一覧の移し先。一覧（[data-work-list]）は画面に1つだけ描画される前提で document から探す。指定した行（描画されていれば）、無ければ roving の行（tabindex=0）、行が無ければ（空の一覧）コンテナ */
export function focusListEntry(workId: string | null = null) {
  const list = document.querySelector<HTMLElement>("[data-work-list]");
  const row =
    workId === null
      ? null
      : list?.querySelector<HTMLElement>(`[data-work-id="${CSS.escape(workId)}"]`);
  (row ?? list?.querySelector<HTMLElement>("[data-work-id][tabindex='0']") ?? list)?.focus({
    preventScroll: true,
  });
}

/**
 * 作品が一覧から消えたあと、フォーカスが消えた詳細の中にあった（消える前に求める）か失われているときだけ、
 * 隣の行（無ければ roving の行、空ならコンテナ）へ移す。ユーザーが他へ移していたら動かさない。
 */
export function focusListAfterRemoval(workId: string | null, wasInRemovedRoot: boolean) {
  if (wasInRemovedRoot || isFocusLost()) focusListEntry(workId);
}
