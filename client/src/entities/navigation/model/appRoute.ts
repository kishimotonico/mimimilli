import { createRandomSeed, sortIdSchema } from "@mimimilli/shared";
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

/** Libraryの状態。sort・seed は URL に出さず履歴エントリーの状態に書く（ADR-0041） */
export type LibraryRoute = LibraryUrlState & {
  /** 今の並び。null なら既定の並び */
  sort: SortId | null;
  /** ランダムの seed。クライアントだけが発行する */
  seed: number;
};

export type RouteLayer = { kind: "nowPlaying"; openedBy: "app" | "url" } | null;

/** URLは表示中の画面だけを表すが、Library・Filesの状態は他の画面にいる間も保持する */
export type AppRoute = {
  library: LibraryRoute;
  files: FilesUrlState;
  layer: RouteLayer;
} & (
  | { mode: "library" }
  | { mode: "files" }
  | { mode: "nowPlaying" }
  | { mode: "workDetail"; workId: string }
);

export type AppMode = AppRoute["mode"];
/** 対象の指定なしで切り替えられる画面 */
export type SwitchableAppMode = Exclude<AppMode, "workDetail">;

/** 起動時と初期化時のroute。seed はクライアントが作る */
export function createInitialAppRoute(): AppRoute {
  return {
    mode: "library",
    library: { ...DEFAULT_LIBRARY_URL_STATE, sort: null, seed: createRandomSeed() },
    files: { relPath: [], selectedRelPath: null },
    layer: null,
  };
}

/** 履歴エントリーに書く部分 */
interface AppRouteEntryState {
  sort: SortId | null;
  seed: number;
  layer: RouteLayer;
}

export function toNavigationUrlState(route: AppRoute): NavigationUrlState {
  switch (route.mode) {
    case "library": {
      const { sort: _sort, seed: _seed, ...library } = route.library;
      return { mode: "library", library };
    }
    case "files":
      return { mode: "files", files: route.files };
    case "nowPlaying":
      return { mode: "nowPlaying" };
    case "workDetail":
      return { mode: "workDetail", workId: route.workId };
  }
}

export function toEntryState(route: AppRoute): AppRouteEntryState {
  const { sort, seed } = route.library;
  return { sort, seed, layer: route.layer };
}

export function applyNavigationUrlState(route: AppRoute, state: NavigationUrlState): AppRoute {
  const { library, files, layer } = route;
  switch (state.mode) {
    case "library":
      return {
        mode: "library",
        library: { ...state.library, sort: library.sort, seed: library.seed },
        files,
        layer,
      };
    case "files":
      return { mode: "files", library, files: state.files, layer };
    case "nowPlaying":
      return { mode: "nowPlaying", library, files, layer };
    case "workDetail":
      return { mode: "workDetail", workId: state.workId, library, files, layer };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 書かれていない・読めない項目は現在のrouteの値を保つ。sort・seed はURLの library 部分と同じく
 *  library 画面のエントリーからだけ読む。layer は画面をまたいで読む */
function applyEntryState(route: AppRoute, entryState: unknown): AppRoute {
  if (!isRecord(entryState)) return route;
  const withLayer = { ...route, layer: parseLayer(entryState.layer, route.layer) };
  if (route.mode !== "library") return withLayer;
  const sortResult = sortIdSchema.nullable().safeParse(entryState.sort);
  const seed = entryState.seed;
  return {
    ...withLayer,
    library: {
      ...route.library,
      sort: sortResult.success ? sortResult.data : route.library.sort,
      seed: typeof seed === "number" && Number.isInteger(seed) ? seed : route.library.seed,
    },
  };
}

function parseLayer(value: unknown, fallback: RouteLayer): RouteLayer {
  if (value === null) return null;
  if (
    isRecord(value) &&
    value.kind === "nowPlaying" &&
    (value.openedBy === "app" || value.openedBy === "url")
  ) {
    return { kind: "nowPlaying", openedBy: value.openedBy };
  }
  return fallback;
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
