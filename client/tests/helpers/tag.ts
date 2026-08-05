import { normalizeTag, type NormalizedTag } from "@mimimilli/shared";

/** テストフィクスチャ用。文字列を NormalizedTag として扱う。 */
export function nt(tag: string): NormalizedTag {
  const normalized = normalizeTag(tag);
  if (normalized === null) throw new Error(`test fixture tag is not normalizable: ${tag}`);
  return normalized;
}

export function nts(tags: string[]): NormalizedTag[] {
  return tags.map(nt);
}
