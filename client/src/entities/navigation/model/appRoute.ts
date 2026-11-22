import {
  createRandomSeed,
  groupSortIdSchema,
  isRandomSeed,
  sortIdSchema,
  type GroupSortId,
} from "@mimimilli/shared";
import type { SortId } from "../../library/types";
import type {
  ParseContext,
  RouteCodec,
  RouteParseResult,
} from "../../../shared/model/useRouteHistorySync";
import {
  DEFAULT_LIBRARY_URL_STATE,
  parseNavigationUrl,
  serializeNavigationUrl,
  type FilesUrlState,
  type LibraryUrlState,
  type NavigationUrlState,
} from "./navigationUrl";

/** Libraryの状態。sort・groupSort・seed は URL に出さず履歴エントリーの状態に書く（ADR-0041） */
export type LibraryRoute = LibraryUrlState & {
  /** 今の並び。null なら既定の並び */
  sort: SortId | null;
  /** 今の値一覧の並び。null なら既定の並び */
  groupSort: GroupSortId | null;
  /** ランダムの seed。クライアントだけが発行する */
  seed: number;
};

/** 層を、アプリの中で開いたか、`np=1` の URL を直接開いたか */
export type LayerOpenedBy = "app" | "url";

export type RouteLayer = { kind: "nowPlaying"; openedBy: LayerOpenedBy } | null;

/** URLは表示中の画面だけを表すが、Library・Filesの状態は他の画面にいる間も保持する */
export type AppRoute = {
  library: LibraryRoute;
  files: FilesUrlState;
  layer: RouteLayer;
} & ({ mode: "library" } | { mode: "files" } | { mode: "workDetail"; workId: string });

export type AppMode = AppRoute["mode"];
/** 対象の指定なしで切り替えられる画面 */
export type SwitchableAppMode = Exclude<AppMode, "workDetail">;

/** 起動時と初期化時のroute。seed はクライアントが作る */
export function createInitialAppRoute(): AppRoute {
  return {
    mode: "library",
    library: {
      ...DEFAULT_LIBRARY_URL_STATE,
      sort: null,
      groupSort: null,
      seed: createRandomSeed(),
    },
    files: { relPath: [], selectedRelPath: null },
    layer: null,
  };
}

/** 履歴エントリーに書く部分 */
type AppRouteEntryState = { layer: RouteLayer } & (
  | { sort: SortId | null; groupSort: GroupSortId | null; seed: number }
  | { sort?: undefined; groupSort?: undefined; seed?: undefined }
);

export function toNavigationUrlState(route: AppRoute): NavigationUrlState {
  const np = route.layer !== null;
  switch (route.mode) {
    case "library": {
      const { sort: _sort, groupSort: _groupSort, seed: _seed, ...library } = route.library;
      return { mode: "library", library, np };
    }
    case "files":
      return { mode: "files", files: route.files, np };
    case "workDetail":
      return { mode: "workDetail", workId: route.workId, np };
  }
}

/** sort・groupSort・seed は library 画面のエントリーにだけ書く（読む側の applyEntryState と対称） */
export function toEntryState(route: AppRoute): AppRouteEntryState {
  if (route.mode !== "library") return { layer: route.layer };
  const { sort, groupSort, seed } = route.library;
  return { sort, groupSort, seed, layer: route.layer };
}

/** 層の開き方は履歴エントリーの状態にだけ書く。URL に np=1 があって開き方が読めなければ、URL を直接開いたものとみなす */
function applyNavigationUrlState(
  route: AppRoute,
  state: NavigationUrlState,
  openedBy: LayerOpenedBy,
): AppRoute {
  const { library, files } = route;
  const layer: RouteLayer = state.np ? { kind: "nowPlaying", openedBy } : null;
  switch (state.mode) {
    case "library":
      return {
        mode: "library",
        library: {
          ...state.library,
          sort: library.sort,
          groupSort: library.groupSort,
          seed: library.seed,
        },
        files,
        layer,
      };
    case "files":
      return { mode: "files", library, files: state.files, layer };
    case "workDetail":
      return { mode: "workDetail", workId: state.workId, library, files, layer };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 書かれていない・読めない項目は現在のrouteの値を保つ。sort・groupSort・seed はURLの library 部分と同じく
 *  library 画面のエントリーからだけ読む */
function applyEntryState(route: AppRoute, entryState: unknown): AppRoute {
  if (!isRecord(entryState) || route.mode !== "library") return route;
  const sortResult = sortIdSchema.nullable().safeParse(entryState.sort);
  const groupSortResult = groupSortIdSchema.nullable().safeParse(entryState.groupSort);
  const seed = entryState.seed;
  return {
    ...route,
    library: {
      ...route.library,
      sort: sortResult.success ? sortResult.data : route.library.sort,
      groupSort: groupSortResult.success ? groupSortResult.data : route.library.groupSort,
      seed: isRandomSeed(seed) ? seed : route.library.seed,
    },
  };
}

function readLayerOpenedBy(entryState: unknown): LayerOpenedBy {
  if (!isRecord(entryState) || !isRecord(entryState.layer)) return "url";
  return entryState.layer.openedBy === "app" ? "app" : "url";
}

/** アプリの中で開いた層を、すぐ下のエントリーへ戻って閉じるとき。層の間は library をユーザーが変えられず、
 *  変わるのは補正だけなので、層を開いていたときの library が正で、下のエントリーの library は古い */
function closesLayerBelow(
  current: AppRoute,
  state: NavigationUrlState,
  context: ParseContext | undefined,
): boolean {
  return (
    context?.delta === -1 &&
    current.mode === "library" &&
    state.mode === "library" &&
    !state.np &&
    current.layer?.openedBy === "app"
  );
}

export const appRouteCodec: RouteCodec<AppRoute> = {
  parse(href, entryState, context): RouteParseResult<AppRoute> {
    const { state, canonicalUrl, warnings } = parseNavigationUrl(href);
    return {
      canonicalUrl,
      warnings,
      apply: (current) =>
        closesLayerBelow(current, state, context)
          ? { ...current, layer: null }
          : applyEntryState(
              applyNavigationUrlState(current, state, readLayerOpenedBy(entryState)),
              entryState,
            ),
    };
  },
  serialize: (route) => ({
    url: serializeNavigationUrl(toNavigationUrlState(route)),
    entryState: toEntryState(route),
  }),
};
