// 新規登録済み・更新された作品タブ共通: work ID列の表示上限切り詰めと表示順の復元。
import { WORKS_DEFAULT_PAGE_SIZE } from "@mimimilli/shared";
import type { WorkListItem } from "@mimimilli/shared";

export interface VisibleWorkIds {
  visible: string[];
  /** idsの総数がvisibleより多く、表示を先頭のみに絞っているときはその総数。絞っていなければnull */
  truncatedTotal: number | null;
}

/** ids が数千〜数万件になりうるため、表示・取得は先頭の1ページ分に制限する。
 *  全件をidsへ載せるとURLとSQLite束縛パラメータの上限を超える。 */
export function sliceForDisplay(ids: string[]): VisibleWorkIds {
  const visible = ids.slice(0, WORKS_DEFAULT_PAGE_SIZE);
  return { visible, truncatedTotal: ids.length > visible.length ? ids.length : null };
}

/** 検索結果は順序を保証しないため、渡した ids の順序へ並べ替える */
export function orderByIds(items: WorkListItem[], ids: string[]): WorkListItem[] {
  const order = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** 重複を除いて先頭の出現を残したまま結合する */
export function dedupeIds(...idLists: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const ids of idLists) {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/** root相対パス（work自身のフォルダーのパス）から、フォルダー列に出す親ディレクトリ部分を取り出す。
 *  ライブラリルート直下（親が無い）場合は空文字。 */
export function parentDirOf(relativePath: string): string {
  const idx = relativePath.lastIndexOf("/");
  return idx === -1 ? "" : relativePath.slice(0, idx);
}
