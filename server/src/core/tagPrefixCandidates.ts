// 未登録 prefix の候補集計（GET /api/tag-prefixes/candidates）の純粋関数。
// 設定UIの「データ中にあるが未登録の prefix」サジェストに使う（ADR-0005: 明示登録制）。
import { parseTag, tagPrefixNameSchema } from "@mimimilli/shared";
import type { TagPrefixCandidate, WorkSummary } from "@mimimilli/shared";

/** works のタグから annotated prefix の出現件数を集計し、登録済みを除いて count 降順で返す */
export function buildTagPrefixCandidates(
  works: WorkSummary[],
  registeredPrefixes: string[],
): TagPrefixCandidate[] {
  const registered = new Set(registeredPrefixes);
  const counts = new Map<string, number>();

  for (const work of works) {
    for (const tag of work.tags) {
      const parsed = parseTag(tag);
      if (
        parsed.kind !== "annotated" ||
        registered.has(parsed.prefix) ||
        !tagPrefixNameSchema.safeParse(parsed.prefix).success
      )
        continue;
      counts.set(parsed.prefix, (counts.get(parsed.prefix) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix, "ja"));
}
