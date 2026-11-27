import type { DlsiteCoverSkipReason } from "@mimimilli/shared";

/** カバーを適用できなかった理由の文言。理由を伝えないものは空文字 */
const COVER_SKIP_CAUSE: Record<DlsiteCoverSkipReason, string> = {
  not_cached: "カバー画像を取得できていないため、",
  outside_root: "",
  unreadable: "",
};

export function coverSkipCause(reason: DlsiteCoverSkipReason): string {
  return COVER_SKIP_CAUSE[reason];
}

/** 同じ文言になる理由ごとに作品名をまとめる。文言のある理由が先 */
export function groupCoverSkipped(
  skipped: readonly { title: string; reason: DlsiteCoverSkipReason }[],
): { cause: string; titles: string[] }[] {
  const causes = [...new Set(Object.values(COVER_SKIP_CAUSE))];
  return causes
    .map((cause) => ({
      cause,
      titles: skipped
        .filter(({ reason }) => COVER_SKIP_CAUSE[reason] === cause)
        .map((e) => e.title),
    }))
    .filter(({ titles }) => titles.length > 0);
}
