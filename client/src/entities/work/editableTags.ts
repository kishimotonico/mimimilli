// タグ集合の編集操作（ADR-0005: 構造化タグ含む全タグが編集対象）。
// PATCH /works/:id の tags は全置換なので、編集後の全集合を組み立てて返す。
// 同一性は tagEquals（prefix は大文字小文字を無視、値は区別）で判定する。
// tags 引数はユーザー入力由来（登録フォームの下書き）・work.tags 由来（正規化済み）の
// どちらもあり得る境界の関数のため、内部で常に正規化してから比較する。
import {
  dedupeTags,
  normalizeTag,
  normalizeTags,
  tagEquals,
  type NormalizedTag,
} from "@mimimilli/shared";

/** タグを追加した全集合。空・重複（正規化後）で追加できない場合は null */
export function buildTagsWithAdded(tags: string[], newTag: string): NormalizedTag[] | null {
  const normalized = normalizeTag(newTag);
  if (normalized === null) return null;
  const existing = dedupeTags(normalizeTags(tags));
  if (existing.some((tag) => tagEquals(tag, normalized))) return null;
  return [...existing, normalized];
}

/** タグを削除した全集合 */
export function buildTagsWithRemoved(tags: string[], target: string): NormalizedTag[] {
  const normalizedTarget = normalizeTag(target);
  const normalizedTags = dedupeTags(normalizeTags(tags));
  if (normalizedTarget === null) return normalizedTags;
  return normalizedTags.filter((tag) => !tagEquals(tag, normalizedTarget));
}
