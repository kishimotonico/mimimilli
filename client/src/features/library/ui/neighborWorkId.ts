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

/** 一覧の移し先: 決めておいた隣の行、描画外なら roving の行（tabindex=0）、行が無ければ一覧のコンテナ */
export function focusListEntry(container: HTMLElement | null, neighborId: string | null = null) {
  const row =
    neighborId === null
      ? null
      : container?.querySelector<HTMLElement>(`[data-work-id="${CSS.escape(neighborId)}"]`);
  (
    row ??
    container?.querySelector<HTMLElement>("[data-work-id][tabindex='0']") ??
    container
  )?.focus({ preventScroll: true });
}
