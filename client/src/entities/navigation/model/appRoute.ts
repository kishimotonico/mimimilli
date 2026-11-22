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
  const np = route.layer !== null;
  switch (route.mode) {
    case "library": {
      const { sort: _sort, seed: _seed, ...library } = route.library;
      return { mode: "library", library, np };
    }
    case "files":
      return { mode: "files", files: route.files, np };
    case "workDetail":
      return { mode: "workDetail", workId: route.workId, np };
  }
}

export function toEntryState(route: AppRoute): AppRouteEntryState {
  const { sort, seed } = route.library;
  return { sort, seed, layer: route.layer };
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
        library: { ...state.library, sort: library.sort, seed: library.seed },
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

/** 書かれていない・読めない項目は現在のrouteの値を保つ。sort・seed はURLの library 部分と同じく
 *  library 画面のエントリーからだけ読む */
function applyEntryState(route: AppRoute, entryState: unknown): AppRoute {
  if (!isRecord(entryState) || route.mode !== "library") return route;
  const sortResult = sortIdSchema.nullable().safeParse(entryState.sort);
  const seed = entryState.seed;
  return {
    ...route,
    library: {
      ...route.library,
      sort: sortResult.success ? sortResult.data : route.library.sort,
      seed: typeof seed === "number" && Number.isInteger(seed) ? seed : route.library.seed,
    },
  };
}

function readLayerOpenedBy(entryState: unknown): LayerOpenedBy {
  if (!isRecord(entryState) || !isRecord(entryState.layer)) return "url";
  return entryState.layer.openedBy === "app" ? "app" : "url";
}

export const appRouteCodec: RouteCodec<AppRoute> = {
  parse(href, entryState): RouteParseResult<AppRoute> {
    const { state, canonicalUrl, warnings } = parseNavigationUrl(href);
    return {
      canonicalUrl,
      warnings,
      apply: (current) =>
        applyEntryState(
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
