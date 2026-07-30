import type { TagPrefixColorKey } from "@mimimilli/shared";

/** tokens.css のタグカテゴリ色変数への対応。wire/persistence の key はここだけで CSS に解決する */
export const TAG_PREFIX_COLOR_CSS_VARS: Record<TagPrefixColorKey, string> = {
  cv: "var(--cv-color)",
  circle: "var(--circle-color)",
  series: "var(--series-color)",
  cat: "var(--cat-color)",
};

const DEFAULT_TAG_PREFIX_COLOR_KEY: TagPrefixColorKey = "cat";

/** prefix 定義の color key をインライン style 用の CSS 色値へ変換する */
export function tagPrefixColorToCss(color: TagPrefixColorKey | null | undefined): string {
  if (color == null) return TAG_PREFIX_COLOR_CSS_VARS[DEFAULT_TAG_PREFIX_COLOR_KEY];
  return TAG_PREFIX_COLOR_CSS_VARS[color];
}
