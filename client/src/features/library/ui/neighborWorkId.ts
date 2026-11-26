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

/** 作品が消えたあとのフォーカスの移し先: 決めておいた隣の行、無ければ（一覧が空になるときなど）一覧そのもの */
export function focusWorkRowOrList(workId: string | null) {
  const row =
    workId === null
      ? null
      : document.querySelector<HTMLElement>(`[data-work-id="${CSS.escape(workId)}"]`);
  (row ?? document.querySelector<HTMLElement>("[data-work-list]"))?.focus({ preventScroll: true });
}
