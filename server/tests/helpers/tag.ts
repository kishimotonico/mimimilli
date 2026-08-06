import {
  EMPTY_TAG_FILTERS,
  normalizeTag,
  tagFiltersFromSelected,
  type NormalizedTag,
  type TagFilters,
} from "@mimimilli/shared";

/** テストフィクスチャ用。文字列を NormalizedTag として扱う。既に正規形で書かれている前提で、
 *  normalizeTag を通した結果が入力と一致しない（= フィクスチャの書き方が正規形でない）場合は
 *  テストの前提が崩れているため例外にする。 */
export function nt(tag: string): NormalizedTag {
  const normalized = normalizeTag(tag);
  if (normalized === null || normalized !== tag) {
    throw new Error(`テストフィクスチャのタグが正規形ではありません: ${tag}`);
  }
  return normalized;
}

export function nts(tags: string[]): NormalizedTag[] {
  return tags.map(nt);
}

/** WorksQuery.tags 等の TagFilters をテスト用に組み立てる */
export function tf(...rawTags: string[]): TagFilters {
  return tagFiltersFromSelected(rawTags);
}

export { EMPTY_TAG_FILTERS };
