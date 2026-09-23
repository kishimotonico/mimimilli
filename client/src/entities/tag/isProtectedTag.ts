import { parseTag } from "@mimimilli/shared";
import type { NormalizedTag, TagPrefix } from "@mimimilli/shared";

/** 保護判定（protected な prefix のタグは削除前に確認を挟む。ADR-0005） */
export function isProtectedTag(tag: NormalizedTag, tagPrefixes: TagPrefix[]): boolean {
  const parsed = parseTag(tag);
  if (parsed.kind !== "annotated") return false;
  return tagPrefixes.some((p) => p.prefix === parsed.prefix && p.protected);
}
