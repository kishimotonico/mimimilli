// タグ集合の編集操作（ADR-0005: 構造化タグ含む全タグが編集対象）。
// PATCH /works/:id の tags は全置換なので、編集後の全集合を組み立てて返す。
// 同一性は tagEquals（prefix は大文字小文字を無視、値は区別）で判定する。
import { normalizeTag, normalizeTags, tagEquals } from "@mimimilli/shared";

/** タグを追加した全集合。空・重複（正規化後）で追加できない場合は null */
export function buildTagsWithAdded(tags: string[], newTag: string): string[] | null {
  const normalized = normalizeTag(newTag);
  if (!normalized) return null;
  if (tags.some((tag) => tagEquals(tag, normalized))) return null;
  return normalizeTags([...tags, normalized]);
}

/** タグを削除した全集合 */
export function buildTagsWithRemoved(tags: string[], target: string): string[] {
  return normalizeTags(tags.filter((tag) => !tagEquals(tag, target)));
}
