import { parseTag } from "@mimimilli/shared";
import type { TagPrefix } from "@mimimilli/shared";

/**
 * タグを prefix 定義順、未登録 prefix、フラットタグの順に並べる。
 * 各グループ内の登録順は保ち、入力配列は変更しない。
 */
export function sortTagsForDisplay<T extends string>(tags: T[], tagPrefixes: TagPrefix[]): T[] {
  const prefixIndexes = new Map(
    tagPrefixes.map((definition, index) => [definition.prefix, index] as const),
  );
  const definedPrefixTags = tagPrefixes.map(() => [] as T[]);
  const unknownPrefixTags: T[] = [];
  const flatTags: T[] = [];

  for (const tag of tags) {
    const parsed = parseTag(tag);
    if (parsed.kind === "flat") {
      flatTags.push(tag);
      continue;
    }

    const prefixIndex = prefixIndexes.get(parsed.prefix);
    if (prefixIndex === undefined) {
      unknownPrefixTags.push(tag);
    } else {
      const bucket = definedPrefixTags[prefixIndex];
      if (bucket === undefined) {
        throw new Error(`internal: prefix bucket missing for ${parsed.prefix}`);
      }
      bucket.push(tag);
    }
  }

  return [...definedPrefixTags.flat(), ...unknownPrefixTags, ...flatTags];
}
