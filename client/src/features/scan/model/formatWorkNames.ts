/** 作品名を「A」、複数なら「A」他N件にする */
export function formatWorkNames(titles: readonly string[]): string {
  const [first = ""] = titles;
  return titles.length > 1 ? `「${first}」他${titles.length - 1}件` : `「${first}」`;
}
