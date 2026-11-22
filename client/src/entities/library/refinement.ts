import { normalizeSearchQuery } from "@mimimilli/shared";

/** チップか検索語で絞り込んでいるか。空白だけの検索語は絞り込みに数えない */
export function hasChipOrSearchRefinement(input: {
  selectedTags: readonly string[];
  q: string | undefined;
}): boolean {
  return input.selectedTags.length > 0 || normalizeSearchQuery(input.q) !== "";
}
