// Library の各操作が現在のrouteから次のrouteとpush/replaceを決める（ADR-0013・ADR-0031・ADR-0041）。
import {
  ALL_SMART_FOLDER_ID,
  createRandomSeed,
  isBuiltinPseudoTagKey,
  normalizeSearchQuery,
  parseBuiltinPseudoTag,
  type NormalizedTag,
  type SmartFolder,
  type GroupSortId,
  type SortId,
} from "@mimimilli/shared";
import type { RouteTransition } from "../../../shared/model/routeStore";
import type { AppRoute, LibraryRoute } from "../../navigation/model/appRoute";
import { resolveLibraryView, type ResolvedLibraryView } from "../resolveLibraryView";

type Transition = RouteTransition<AppRoute>;

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

/** 入り直し。今の並び（作品・値）を捨て、新しい seed にする */
function enter(
  route: AppRoute,
  patch: Pick<LibraryRoute, "folderId" | "group" | "selectedTags" | "q">,
): AppRoute {
  return withLibrary(route, {
    ...patch,
    selectedWorkId: null,
    sort: null,
    groupSort: null,
    seed: createRandomSeed(),
  });
}

/** サイドバーからスマートフォルダーへ入る。チップと検索語は持ち越さない */
export function openLibraryFolder(route: AppRoute, folderId: string): Transition {
  return {
    route: enter(route, { folderId, group: null, selectedTags: [], q: "" }),
  };
}

/** 操作を始めたときにいた場所。await のあとに同じ場所にいるかを確かめるのに使う */
export interface LibraryPlace {
  mode: AppRoute["mode"];
  /** 作品詳細のときの作品 ID */
  workId: string | null;
  layerOpen: boolean;
  folderId: string;
  /** 操作を始めたときの絞り込み・選択・並び（待つ間にユーザーが変えたかを見分ける） */
  library: string;
}

export function libraryPlaceOf(route: AppRoute): LibraryPlace {
  return {
    mode: route.mode,
    workId: route.mode === "workDetail" ? route.workId : null,
    layerOpen: route.layer !== null,
    folderId: route.library.folderId,
    library: JSON.stringify([
      route.library.group,
      route.library.selectedTags,
      route.library.selectedWorkId,
      route.library.q,
      route.library.sort,
      route.library.groupSort,
    ]),
  };
}

/** 始めた場所と今が同じ画面か。今は層が開いていないことも条件にする */
export function isSamePlace(now: LibraryPlace, started: LibraryPlace): boolean {
  return (
    !now.layerOpen &&
    now.mode === started.mode &&
    now.workId === started.workId &&
    now.folderId === started.folderId &&
    now.library === started.library
  );
}

/** 上書きのあと、同じスマートフォルダーへ入り直す。並びだけの上書きでURLが同じでも履歴を積み、
 *  戻るで上書き前の表示へ戻れるようにする */
export function reenterLibraryFolder(route: AppRoute, folderId: string): Transition {
  return { ...openLibraryFolder(route, folderId), pushSameUrl: true };
}

/** 保持しているライブラリが from を指しているときだけ、to へ入り直す（補正）。
 *  開いているスマートフォルダーが消えた・グループ分けが変わったときに使う */
export function replaceLibraryFolder(
  route: AppRoute,
  from: string,
  to: string,
): LibraryRoute | null {
  if (route.library.folderId !== from) return null;
  return openLibraryFolder(route, to).route.library;
}

/** 保持しているライブラリを、スマートフォルダー一覧に合わせて書き戻す（補正）。存在しないスマートフォルダーは
 *  「すべて」へ、グループ分けの無いスマートフォルダーの group は落とす。チップ・検索語・並びは保つ */
export function normalizeLibraryFolder(
  route: AppRoute,
  folders: readonly SmartFolder[],
): LibraryRoute | null {
  const { library } = route;
  const folder = folders.find((item) => item.id === library.folderId);
  if (folder === undefined) return { ...library, folderId: ALL_SMART_FOLDER_ID, group: null };
  if (folder.groupBy === null && library.group !== null) return { ...library, group: null };
  return null;
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
export function selectLibraryGroupValue(
  route: AppRoute,
  group: string,
  folders: readonly SmartFolder[],
): Transition | null {
  const view = resolveLibraryView(route.library, folders);
  if (view.kind === "works" && view.group === group) return null;
  const fromValueList = view.kind === "value-list";
  return {
    route: withLibrary(route, {
      group,
      selectedWorkId: null,
      ...(fromValueList ? { selectedTags: [], q: "" } : {}),
    }),
  };
}

/** 「すべて」＋チップ・検索語へ移る。entering でなく、すでに「すべて」の作品一覧なら並びと seed を保つ */
function toAll(
  route: AppRoute,
  view: ResolvedLibraryView,
  selectedTags: NormalizedTag[],
  q: string,
  { entering }: { entering: boolean },
): AppRoute {
  const stay = view.kind === "works" && view.folder.id === ALL_SMART_FOLDER_ID;
  if (stay && !entering) {
    return withLibrary(route, { selectedTags, q, selectedWorkId: null });
  }
  return enter(route, { folderId: ALL_SMART_FOLDER_ID, group: null, selectedTags, q });
}

/** プレビュー・作品詳細などでのタグの主クリック。常に「すべて」＋そのタグ（ADR-0041） */
export function openLibraryTag(
  route: AppRoute,
  tag: NormalizedTag,
  folders: readonly SmartFolder[],
): Transition {
  const view = resolveLibraryView(route.library, folders);
  return { route: toAll(route, view, [tag], "", { entering: false }) };
}

/** タグの Ctrl+クリック・クイックオーバーレイの追加ボタン。作品一覧ならチップを足し、
 *  値一覧なら「すべて」＋そのチップ */
export function addLibraryTag(
  route: AppRoute,
  tag: NormalizedTag,
  folders: readonly SmartFolder[],
): Transition | null {
  const view = resolveLibraryView(route.library, folders);
  if (view.kind !== "works") return { route: toAll(route, view, [tag], "", { entering: true }) };
  const prev = view.selectedTags;
  if (prev.includes(tag) && route.mode === "library" && route.layer === null) return null;
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

/** 値一覧の並びメニューでの変更。今の値の並びとして履歴エントリーへ書く */
export function setLibraryGroupSort(route: AppRoute, groupSort: GroupSortId): Transition | null {
  if (route.library.groupSort === groupSort) return null;
  return { route: withLibrary(route, { groupSort }), replace: true };
}

/** 今の値の並びを既定として保存したあと、今の並びを外して既定に従わせる。保存を始めたときと
 *  同じスマートフォルダー・同じ並びにいるときだけ外す */
export function clearLibraryGroupSort(
  route: AppRoute,
  saved: { folderId: string; groupSort: GroupSortId },
): LibraryRoute | null {
  const { library } = route;
  if (library.folderId !== saved.folderId || library.groupSort !== saved.groupSort) return null;
  return { ...library, groupSort: null };
}

/** 今の並びを既定として保存したあと、今の並びを外して既定に従わせる。保存を始めたときと
 *  同じスマートフォルダー・同じ並びにいるときだけ外す */
export function clearLibrarySort(
  route: AppRoute,
  saved: { folderId: string; sort: SortId },
): LibraryRoute | null {
  const { library } = route;
  if (library.folderId !== saved.folderId || library.sort !== saved.sort) return null;
  return { ...library, sort: null };
}

/** 選択中の作品を外す（補正） */
export function deselectLibraryWork(route: AppRoute): LibraryRoute | null {
  const { library } = route;
  return library.selectedWorkId === null ? null : { ...library, selectedWorkId: null };
}

export function reshuffleLibrarySeed(route: AppRoute): Transition {
  return { route: withLibrary(route, { seed: createRandomSeed() }), replace: true };
}

/** 検索欄の入力。作品一覧ならその一覧で検索し（ライブラリの中なら履歴を置き換え、作品詳細・ファイルからは積む）、
 *  値一覧・読めない行なら「すべて」の検索結果へ移る */
export function setLibrarySearchQuery(
  route: AppRoute,
  q: string,
  folders: readonly SmartFolder[],
): Transition | null {
  const view = resolveLibraryView(route.library, folders);
  if (view.kind === "works") {
    if (view.q === q) return null;
    return { route: withLibrary(route, { q }), replace: route.mode === "library" };
  }
  if (normalizeSearchQuery(q) === "") return null;
  return { route: toAll(route, view, [], q, { entering: true }) };
}

/** 0件のとき、同じチップと検索語のまま「すべて」で探す */
export function searchLibraryInAll(
  route: AppRoute,
  folders: readonly SmartFolder[],
): Transition | null {
  const view = resolveLibraryView(route.library, folders);
  if (view.kind !== "works") return null;
  return { route: toAll(route, view, view.selectedTags, view.q, { entering: true }) };
}

/** グループの値の作品一覧から、そのスマートフォルダーの値一覧へ戻る */
export function backToLibraryValueList(
  route: AppRoute,
  folders: readonly SmartFolder[],
): Transition | null {
  const view = resolveLibraryView(route.library, folders);
  if (view.kind !== "works" || view.group === null) return null;
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
