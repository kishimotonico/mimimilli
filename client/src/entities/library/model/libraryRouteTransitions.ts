// Library の各操作が現在のrouteから次のrouteとpush/replaceを決める（ADR-0013・ADR-0031・ADR-0041）。
import {
  ALL_SMART_FOLDER_ID,
  createRandomSeed,
  isBuiltinPseudoTagKey,
  parseBuiltinPseudoTag,
  type NormalizedTag,
  type SortId,
} from "@mimimilli/shared";
import type { RouteTransition } from "../../../shared/model/routeStore";
import type { AppRoute, LibraryRoute } from "../../navigation/model/appRoute";
import type { ResolvedViewKind } from "../resolveLibraryView";

type Transition = RouteTransition<AppRoute>;

/** 保持しているライブラリが作品一覧か（チップ・検索語が効く）。値一覧と読めない行は効かない */
export type HeldLibrary = ResolvedViewKind;

function withLibrary(route: AppRoute, patch: Partial<LibraryRoute>): AppRoute {
  return {
    mode: "library",
    library: { ...route.library, ...patch },
    files: route.files,
    layer: route.layer,
  };
}

/** 組み込み擬似タグ（year等）は同じキーの既存選択を外してから追加する */
function appendTag(tags: NormalizedTag[], tag: NormalizedTag): NormalizedTag[] {
  const builtin = parseBuiltinPseudoTag(tag);
  const base =
    builtin && isBuiltinPseudoTagKey(builtin.key)
      ? tags.filter((t) => parseBuiltinPseudoTag(t)?.key !== builtin.key)
      : tags;
  return [...base, tag];
}

/** 入り直し。今の並びを捨て、新しい seed にする */
function enter(
  route: AppRoute,
  patch: Pick<LibraryRoute, "folderId" | "group" | "selectedTags" | "q">,
): AppRoute {
  return withLibrary(route, {
    ...patch,
    selectedWorkId: null,
    sort: null,
    seed: createRandomSeed(),
  });
}

/** サイドバーからスマートフォルダーへ入る。チップと検索語は持ち越さない */
export function openLibraryFolder(route: AppRoute, folderId: string): Transition {
  return {
    route: enter(route, { folderId, group: null, selectedTags: [], q: "" }),
  };
}

/** 開いているスマートフォルダーが消えたとき、履歴を積まずに入り直す。作品詳細などライブラリ以外の画面で
 *  保持しているライブラリの folderId も置き換え、画面はそのまま保つ */
export function replaceLibraryFolder(route: AppRoute, folderId: string): Transition {
  const entered = openLibraryFolder(route, folderId).route;
  return {
    route: route.mode === "library" ? entered : { ...route, library: entered.library },
    replace: true,
  };
}

/** サイドバーのクイックオーバーレイから、グループの値の作品一覧へ入る */
export function openLibraryGroupValue(
  route: AppRoute,
  folderId: string,
  group: string,
): Transition {
  return { route: enter(route, { folderId, group, selectedTags: [], q: "" }) };
}

/** 開いているスマートフォルダーの値を選ぶ。値一覧からは作品一覧へ、作品一覧のパンくずからは
 *  兄弟の値へ移る。値一覧では効かないチップ・検索語は持ち込まない */
export function selectLibraryGroupValue(route: AppRoute, group: string): Transition | null {
  const { library } = route;
  if (library.group === group) return null;
  const fromValueList = library.group === null;
  return {
    route: withLibrary(route, {
      group,
      selectedWorkId: null,
      ...(fromValueList ? { selectedTags: [], q: "" } : {}),
    }),
  };
}

/** 「すべて」＋チップ・検索語へ移る。すでに「すべて」の作品一覧なら並びと seed を保つ */
function toAll(
  route: AppRoute,
  selectedTags: NormalizedTag[],
  q: string,
  { entering }: { entering: boolean },
): AppRoute {
  const { library } = route;
  const stay = library.folderId === ALL_SMART_FOLDER_ID && library.group === null;
  if (stay && !entering) {
    return withLibrary(route, { selectedTags, q, selectedWorkId: null });
  }
  return enter(route, { folderId: ALL_SMART_FOLDER_ID, group: null, selectedTags, q });
}

/** プレビュー・作品詳細などでのタグの主クリック。常に「すべて」＋そのタグ（ADR-0041） */
export function openLibraryTag(route: AppRoute, tag: NormalizedTag): Transition {
  return { route: toAll(route, [tag], "", { entering: false }) };
}

/** タグの Ctrl+クリック・クイックオーバーレイの追加ボタン。作品一覧ならチップを足し、
 *  値一覧なら「すべて」＋そのチップ */
export function addLibraryTag(
  route: AppRoute,
  tag: NormalizedTag,
  held: HeldLibrary,
): Transition | null {
  if (held !== "works") return { route: toAll(route, [tag], "", { entering: true }) };
  const prev = route.library.selectedTags;
  if (prev.includes(tag) && route.mode === "library") return null;
  return {
    route: withLibrary(route, {
      selectedTags: prev.includes(tag) ? prev : appendTag(prev, tag),
      selectedWorkId: null,
    }),
  };
}

export function removeLibraryTag(route: AppRoute, tag: NormalizedTag): Transition {
  return {
    route: withLibrary(route, {
      selectedTags: route.library.selectedTags.filter((t) => t !== tag),
      selectedWorkId: null,
    }),
  };
}

export function clearLibraryTags(route: AppRoute): Transition {
  return { route: withLibrary(route, { selectedTags: [], selectedWorkId: null }) };
}

export function selectLibraryWork(route: AppRoute, id: string | null): Transition | null {
  const current = route.library.selectedWorkId;
  if (current === id) return null;
  return {
    route: withLibrary(route, { selectedWorkId: id }),
    replace: !(current === null && id !== null),
  };
}

/** 並び順メニューでの変更。今の並びとして履歴エントリーへ書く */
export function setLibrarySort(route: AppRoute, sort: SortId): Transition | null {
  if (route.library.sort === sort) return null;
  return { route: withLibrary(route, { sort }), replace: true };
}

/** 今の並びを既定として保存したあと、今の並びを外して既定に従わせる。保存を始めたときと
 *  同じスマートフォルダー・同じ並びにいるときだけ外す */
export function clearLibrarySort(
  route: AppRoute,
  saved: { folderId: string; sort: SortId },
): Transition | null {
  const { library } = route;
  if (library.folderId !== saved.folderId || library.sort !== saved.sort) return null;
  return { route: withLibrary(route, { sort: null }), replace: true };
}

export function reshuffleLibrarySeed(route: AppRoute): Transition {
  return { route: withLibrary(route, { seed: createRandomSeed() }), replace: true };
}

/** 検索欄の入力。作品一覧ならその一覧で検索し、値一覧・読めない行なら「すべて」の検索結果へ移る */
export function setLibrarySearchQuery(
  route: AppRoute,
  q: string,
  held: HeldLibrary,
): Transition | null {
  if (held === "works") {
    if ((route.library.q ?? "") === q) return null;
    return { route: withLibrary(route, { q }), replace: true };
  }
  if (q === "") return null;
  return { route: toAll(route, [], q, { entering: true }) };
}

/** 0件のとき、同じチップと検索語のまま「すべて」で探す */
export function searchLibraryInAll(route: AppRoute): Transition {
  const { selectedTags, q } = route.library;
  return { route: toAll(route, selectedTags, q ?? "", { entering: true }) };
}

/** パンくずの先頭（スマートフォルダー名）。グループの値の作品一覧からその値一覧へ戻る */
export function goToLibrarySegment(route: AppRoute, index: number): Transition | null {
  if (index > 0 || route.library.group === null) return null;
  return {
    route: withLibrary(route, { group: null, selectedTags: [], q: "", selectedWorkId: null }),
  };
}

/** 再生中の作品などを、「すべて」で選択した状態で表示する */
export function showLibraryWork(route: AppRoute, workId: string): Transition {
  const next = enter(route, {
    folderId: ALL_SMART_FOLDER_ID,
    group: null,
    selectedTags: [],
    q: "",
  });
  return { route: { ...next, library: { ...next.library, selectedWorkId: workId } } };
}
