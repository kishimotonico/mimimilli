import type { DlsiteCoverSkipReason } from "@mimimilli/shared";

/** 理由ごとの文言。キーの並び順が表示順で、同じ文言の理由は1文にまとめる。理由を伝えない文言は空文字 */
const COVER_SKIP_CAUSE: Record<DlsiteCoverSkipReason, string> = {
  not_cached: "カバー画像を取得できていないため、",
  outside_root: "",
  unreadable: "",
};

const COVER_SKIP_CAUSES = [...new Set(Object.values(COVER_SKIP_CAUSE))];

/** 1件の作品のカバーを適用できなかったことを伝える文 */
export function coverSkipMessage(reason: DlsiteCoverSkipReason): string {
  return `${COVER_SKIP_CAUSE[reason]}カバーは適用できませんでした`;
}

/** 複数の作品のカバーを適用できなかったことを、同じ文言になる理由ごとに伝える文。該当が無ければ空文字 */
export function coverSkipSummary(
  skipped: readonly { title: string; reason: DlsiteCoverSkipReason }[],
  formatTitles: (titles: readonly string[]) => string,
): string {
  return COVER_SKIP_CAUSES.map((cause) => ({
    cause,
    titles: skipped.filter(({ reason }) => COVER_SKIP_CAUSE[reason] === cause).map((e) => e.title),
  }))
    .filter(({ titles }) => titles.length > 0)
    .map(({ cause, titles }) => `${formatTitles(titles)}は${cause}カバーを適用できませんでした。`)
    .join("");
}
