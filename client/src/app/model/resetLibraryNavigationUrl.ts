// root再設定に入るとLibraryのナビゲーションatomをリセットするが、URL（history）は
// NavigationHistorySync（Library画面がアンマウントしている間は非マウント）任せにできない。
// アンマウント中は「atoms→URL」の同期effectが動かないため、URLは古い検索語・タグ・選択作品を
// 保持したままになり、通常画面へ戻ってNavigationHistorySyncが再マウントした瞬間に
// 「URL→atoms」の初期化でリセットしたはずのatomへ古いURLの値が復元されてしまう。
// そのため、atomのリセットと同じタイミングでURLも直接書き換える。
import {
  DEFAULT_LIBRARY_URL_STATE,
  parseNavigationUrl,
  serializeNavigationUrl,
} from "../../features/navigation/model/navigationUrl";

/** 現在のURLがlibraryモードで絞り込み・検索語・選択作品が既定値でなければ、
 *  それらを既定値に戻したURLを返す。それ以外はnull（変更不要）。
 *  sortはナビゲーションatom側もリセット対象外のため、現在値を維持する。 */
export function computeResetLibraryUrl(currentHref: string): string | null {
  const current = parseNavigationUrl(currentHref);
  if (current.state.mode !== "library") return null;
  const library = current.state.library;
  const isAlreadyDefault =
    library.activeAxis === DEFAULT_LIBRARY_URL_STATE.activeAxis &&
    library.selectedTags.length === 0 &&
    library.selectedWorkId === null &&
    (library.q ?? "") === "";
  if (isAlreadyDefault) return null;
  return serializeNavigationUrl({
    mode: "library",
    library: { ...DEFAULT_LIBRARY_URL_STATE, sort: library.sort },
  });
}

export function resetLibraryNavigationUrl(): void {
  if (typeof window === "undefined") return;
  const nextUrl = computeResetLibraryUrl(window.location.href);
  if (nextUrl === null) return;
  window.history.replaceState(window.history.state, "", nextUrl);
}
