// Library の各操作が現在のrouteから次のrouteとpush/replaceを決める（ADR-0012・ADR-0013・ADR-0031）。
import { isBuiltinPseudoTagAxis, parseBuiltinAxisTag, type NormalizedTag } from "@mimimilli/shared";
import type { RouteTransition } from "../../../shared/model/routeStore";
import type { AppRoute } from "../../navigation/model/appRoute";
import type { LibraryUrlState } from "../../navigation/model/navigationUrl";
import { computeResultsPaneKind } from "../resultsPane";
import type { AxisId, SortId } from "../types";

type Transition = RouteTransition<AppRoute>;

function withLibrary(route: AppRoute, patch: Partial<LibraryUrlState>): AppRoute {
  return { ...route, library: { ...route.library, ...patch } };
}

/** 組み込み擬似タグ軸（year等）は同軸の既存選択を外してから追加する */
function appendTag(tags: NormalizedTag[], tag: NormalizedTag): NormalizedTag[] {
  const builtin = parseBuiltinAxisTag(tag);
  const base =
    builtin && isBuiltinPseudoTagAxis(builtin.axis)
      ? tags.filter((t) => parseBuiltinAxisTag(t)?.axis !== builtin.axis)
      : tags;
  return [...base, tag];
}

/** 値一覧（分類値ブラウズ）は現在の絞り込みと独立した全作品の入口（ADR-0026）。
 *  効かない条件を入力欄・チップに残さないよう、遷移時にq・tags（yearの擬似タグ込み）を
 *  消去する。sort・表示モードは軸に依存しないため触らない。 */
export function setLibraryAxis(route: AppRoute, axis: AxisId): Transition {
  const patch: Partial<LibraryUrlState> = { activeAxis: axis, selectedWorkId: null };
  if (computeResultsPaneKind(axis) === "value-list") {
    patch.selectedTags = [];
    patch.q = "";
  }
  return { route: withLibrary(route, patch) };
}

export function toggleLibraryTag(route: AppRoute, tag: NormalizedTag): Transition {
  const prev = route.library.selectedTags;
  const selectedTags = prev.includes(tag) ? prev.filter((t) => t !== tag) : appendTag(prev, tag);
  return { route: withLibrary(route, { selectedTags, selectedWorkId: null }) };
}

export function addLibraryTag(route: AppRoute, tag: NormalizedTag): Transition | null {
  const prev = route.library.selectedTags;
  if (prev.includes(tag)) return null;
  return {
    route: withLibrary(route, { selectedTags: appendTag(prev, tag), selectedWorkId: null }),
  };
}

export function replaceLibraryTag(route: AppRoute, tag: NormalizedTag): Transition {
  const { activeAxis } = route.library;
  return {
    route: withLibrary(route, {
      selectedTags: [tag],
      activeAxis: computeResultsPaneKind(activeAxis) === "works" ? activeAxis : "all",
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

export function setLibrarySort(route: AppRoute, sort: SortId): Transition | null {
  if (route.library.sort === sort) return null;
  return { route: withLibrary(route, { sort }), replace: true };
}

export function setLibrarySearchQuery(route: AppRoute, q: string): Transition | null {
  if ((route.library.q ?? "") === q) return null;
  return { route: withLibrary(route, { q }), replace: true };
}

export function goToLibrarySegment(route: AppRoute, index: number): Transition | null {
  if (index > 0 || route.library.activeAxis === "all") return null;
  return setLibraryAxis(route, "all");
}

/** 再生中の作品などを、Libraryの全作品一覧で選択した状態で表示する */
export function showLibraryWork(route: AppRoute, workId: string): Transition {
  const { route: next } = setLibraryAxis(route, "all");
  return {
    route: {
      mode: "library",
      library: { ...next.library, selectedWorkId: workId },
      files: next.files,
    },
  };
}
