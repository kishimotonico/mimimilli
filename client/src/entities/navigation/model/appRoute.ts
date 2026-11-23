import {
  createRandomSeed,
  groupSortIdSchema,
  isRandomSeed,
  sortIdSchema,
  type GroupSortId,
} from "@mimimilli/shared";
import type { SortId } from "../../library/types";
import type { RouteCodec, RouteParseResult } from "../../../shared/model/useRouteHistorySync";
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

/** 再生中の層。URL には出さず、履歴エントリーの状態にだけ書く */
export type RouteLayer = { kind: "nowPlaying" } | null;

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
  switch (route.mode) {
    case "library": {
      const { sort: _sort, groupSort: _groupSort, seed: _seed, ...library } = route.library;
      return { mode: "library", library };
    }
    case "files":
      return { mode: "files", files: route.files };
    case "workDetail":
      return { mode: "workDetail", workId: route.workId };
  }
}

/** sort・groupSort・seed は library 画面のエントリーにだけ書く（読む側の applyEntryState と対称） */
function toEntryState(route: AppRoute): AppRouteEntryState {
  if (route.mode !== "library") return { layer: route.layer };
  const { sort, groupSort, seed } = route.library;
  return { sort, groupSort, seed, layer: route.layer };
}

function applyNavigationUrlState(route: AppRoute, state: NavigationUrlState): AppRoute {
  const { library, files } = route;
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
        layer: null,
      };
    case "files":
      return { mode: "files", library, files: state.files, layer: null };
    case "workDetail":
      return { mode: "workDetail", workId: state.workId, library, files, layer: null };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readLayer(entryState: unknown): RouteLayer {
  return isRecord(entryState) &&
    isRecord(entryState.layer) &&
    entryState.layer.kind === "nowPlaying"
    ? { kind: "nowPlaying" }
    : null;
}

/** 層は履歴エントリーの状態から読み、無ければ開かない。sort・groupSort・seed は URL の library 部分と同じく
 *  library 画面のエントリーからだけ読み、書かれていない・読めない項目は現在のrouteの値を保つ */
function applyEntryState(route: AppRoute, entryState: unknown): AppRoute {
  const layered = { ...route, layer: readLayer(entryState) };
  if (!isRecord(entryState) || layered.mode !== "library") return layered;
  const sortResult = sortIdSchema.nullable().safeParse(entryState.sort);
  const groupSortResult = groupSortIdSchema.nullable().safeParse(entryState.groupSort);
  const seed = entryState.seed;
  return {
    ...layered,
    library: {
      ...layered.library,
      sort: sortResult.success ? sortResult.data : layered.library.sort,
      groupSort: groupSortResult.success ? groupSortResult.data : layered.library.groupSort,
      seed: isRandomSeed(seed) ? seed : layered.library.seed,
    },
  };
}

export const appRouteCodec: RouteCodec<AppRoute> = {
  parse(href, entryState): RouteParseResult<AppRoute> {
    const { state, canonicalUrl, warnings } = parseNavigationUrl(href);
    return {
      canonicalUrl,
      warnings,
      apply: (current) => applyEntryState(applyNavigationUrlState(current, state), entryState),
    };
  },
  serialize: (route) => ({
    url: serializeNavigationUrl(toNavigationUrlState(route)),
    entryState: toEntryState(route),
  }),
};
