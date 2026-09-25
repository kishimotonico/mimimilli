// root再設定に入るとLibraryのナビゲーションatomをリセットするが、URL（history）は
// NavigationHistorySync（Library画面がアンマウントしている間は非マウント）任せにできない。
// アンマウント中は「atoms→URL」の同期effectが動かないため、URLは古い検索語・タグ・選択作品を
// 保持したままになり、通常画面へ戻ってNavigationHistorySyncが再マウントした瞬間に
// 「URL→atoms」の初期化でリセットしたはずのatomへ古いURLの値が復元されてしまう。
// navigationの構造（parseNavigationUrl等）には手を入れず、URLをルート（既定画面）へ
// replaceするだけの最小修正にとどめる（TASK-466でのAppRoute一本化時に作り直す前提）。
export function computeResetNavigationUrl(currentHref: string): string | null {
  const url = new URL(currentHref, "http://mimimilli.local");
  const current = `${url.pathname}${url.search}`;
  return current === "/" ? null : "/";
}

export function resetLibraryNavigationUrl(): void {
  if (typeof window === "undefined") return;
  const nextUrl = computeResetNavigationUrl(window.location.href);
  if (nextUrl === null) return;
  window.history.replaceState(window.history.state, "", nextUrl);
}
