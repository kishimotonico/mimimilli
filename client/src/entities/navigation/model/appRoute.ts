import type { RouteCodec, RouteParseResult } from "../../../shared/model/useRouteHistorySync";
import {
  DEFAULT_LIBRARY_URL_STATE,
  parseNavigationUrl,
  serializeNavigationUrl,
  type FilesUrlState,
  type LibraryUrlState,
  type NavigationUrlState,
} from "./navigationUrl";

/** URLは表示中の画面だけを表すが、Library・Filesの状態は他の画面にいる間も保持する */
export type AppRoute = {
  library: LibraryUrlState;
  files: FilesUrlState;
} & (
  | { mode: "library" }
  | { mode: "files" }
  | { mode: "nowPlaying" }
  | { mode: "workDetail"; workId: string }
);

export type AppMode = AppRoute["mode"];
/** 対象の指定なしで切り替えられる画面 */
export type SwitchableAppMode = Exclude<AppMode, "workDetail">;

export const DEFAULT_APP_ROUTE: AppRoute = {
  mode: "library",
  library: DEFAULT_LIBRARY_URL_STATE,
  files: { relPath: [], selectedRelPath: null },
};

export function toNavigationUrlState(route: AppRoute): NavigationUrlState {
  switch (route.mode) {
    case "library":
      return { mode: "library", library: route.library };
    case "files":
      return { mode: "files", files: route.files };
    case "nowPlaying":
      return { mode: "nowPlaying" };
    case "workDetail":
      return { mode: "workDetail", workId: route.workId };
  }
}

export function applyNavigationUrlState(route: AppRoute, state: NavigationUrlState): AppRoute {
  const { library, files } = route;
  switch (state.mode) {
    case "library":
      return { mode: "library", library: state.library, files };
    case "files":
      return { mode: "files", library, files: state.files };
    case "nowPlaying":
      return { mode: "nowPlaying", library, files };
    case "workDetail":
      return { mode: "workDetail", workId: state.workId, library, files };
  }
}

export const appRouteCodec: RouteCodec<AppRoute> = {
  parse(href): RouteParseResult<AppRoute> {
    const { state, canonicalUrl, warnings } = parseNavigationUrl(href);
    return {
      canonicalUrl,
      warnings,
      apply: (current) => applyNavigationUrlState(current, state),
    };
  },
  serialize: (route) => serializeNavigationUrl(toNavigationUrlState(route)),
};
