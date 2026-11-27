import type { DlsiteCoverSkipReason } from "@mimimilli/shared";

/** 同じ文言になる理由のまとまり。並び順がそのまま表示順。理由を伝えない文言は空文字 */
const COVER_SKIP_GROUPS: readonly {
  cause: string;
  reasons: readonly DlsiteCoverSkipReason[];
}[] = [
  { cause: "カバー画像を取得できていないため、", reasons: ["not_cached"] },
  { cause: "", reasons: ["outside_root", "unreadable"] },
];

function causeOf(reason: DlsiteCoverSkipReason): string {
  return COVER_SKIP_GROUPS.find((group) => group.reasons.includes(reason))?.cause ?? "";
}

/** 1件の作品のカバーを適用できなかったことを伝える文 */
export function coverSkipMessage(reason: DlsiteCoverSkipReason): string {
  return `${causeOf(reason)}カバーは適用できませんでした`;
}

/** 複数の作品のカバーを適用できなかったことを、同じ文言になる理由ごとに伝える文。該当が無ければ空文字 */
export function coverSkipSummary(
  skipped: readonly { title: string; reason: DlsiteCoverSkipReason }[],
  formatTitles: (titles: readonly string[]) => string,
): string {
  return COVER_SKIP_GROUPS.map(({ cause, reasons }) => ({
    cause,
    titles: skipped.filter(({ reason }) => reasons.includes(reason)).map((e) => e.title),
  }))
    .filter(({ titles }) => titles.length > 0)
    .map(({ cause, titles }) => `${formatTitles(titles)}は${cause}カバーを適用できませんでした。`)
    .join("");
}
