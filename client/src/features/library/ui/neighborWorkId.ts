import { isFocusLost } from "../../../shared/lib/focusReturnTarget";

/**
 * 一覧で、指定した作品の次の行（末尾なら前の行）の作品 ID。登録解除などで作品が消えるとき、
 * フォーカスの移し先を消える前に決めるために使う。描画中の行（data-work-id）から探す。
 */
export function neighborWorkId(workId: string): string | null {
  const rows = [...document.querySelectorAll<HTMLElement>("[data-work-id][data-flat-index]")]
    .map((element) => ({
      id: element.dataset.workId ?? "",
      index: Number(element.dataset.flatIndex),
    }))
    .sort((a, b) => a.index - b.index);
  const at = rows.findIndex((row) => row.id === workId);
  if (at < 0) return null;
  return (rows[at + 1] ?? rows[at - 1])?.id ?? null;
}

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
 * 作品が一覧から消えたあと、フォーカスが消えた詳細（removedRoot）の中か失われているときだけ、
 * 隣の行（無ければ roving の行、空ならコンテナ）へ移す。ユーザーが他へ移していたら動かさない。
 */
export function focusListAfterRemoval(workId: string | null, removedRoot: HTMLElement | null) {
  const active = document.activeElement;
  if (!isFocusLost() && !(active && removedRoot?.contains(active))) return;
  focusListEntry(workId);
}
