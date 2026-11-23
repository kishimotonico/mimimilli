import type { WorkspacePath } from "@mimimilli/shared";
import type { RouteTransition } from "../../../shared/model/routeStore";
import type { AppRoute } from "../../../entities/navigation/model/appRoute";
import type { FilesUrlState } from "../../../entities/navigation/model/navigationUrl";
import { appRouteAction, appRouteStore } from "../../../entities/navigation/model/appRouteStore";
import { toSelectedRelPath } from "../../../entities/file-system/model/navigationAtoms";

function withFiles(route: AppRoute, patch: Partial<FilesUrlState>): AppRoute {
  return { ...route, files: { ...route.files, ...patch } };
}

export function openFilesDir(route: AppRoute, absPath: WorkspacePath): RouteTransition<AppRoute> {
  return {
    route: withFiles(route, {
      relPath: absPath ? absPath.split("/") : [],
      selectedRelPath: toSelectedRelPath(absPath),
    }),
    direction: "forward",
  };
}

export function selectFilesEntry(
  route: AppRoute,
  absPath: WorkspacePath,
): RouteTransition<AppRoute> {
  return {
    route: withFiles(route, { selectedRelPath: toSelectedRelPath(absPath) }),
    replace: true,
  };
}

/** 選択を解除し、カレントフォルダー自身のプレビューへ戻す（URLのselパラメータも消える） */
export function clearFilesSelection(route: AppRoute): RouteTransition<AppRoute> {
  return { route: withFiles(route, { selectedRelPath: null }), replace: true };
}

export function goToFilesSegment(route: AppRoute, index: number): RouteTransition<AppRoute> | null {
  const { relPath, selectedRelPath } = route.files;
  if (index === relPath.length && selectedRelPath === null) return null;
  return {
    route: withFiles(route, { relPath: relPath.slice(0, index), selectedRelPath: null }),
    direction: "back",
  };
}

export function goUpFiles(route: AppRoute): RouteTransition<AppRoute> | null {
  const { relPath } = route.files;
  if (relPath.length === 0) return null;
  return {
    route: withFiles(route, { relPath: relPath.slice(0, -1), selectedRelPath: null }),
    direction: "back",
  };
}

export const openFilesDirAtom = appRouteAction(openFilesDir);
export const selectFilesEntryAtom = appRouteAction(selectFilesEntry);
export const clearFilesSelectionAtom = appRouteAction(clearFilesSelection);
/** 補正: 選択が path のままなら解除する。await のあとに走っても層と画面は変えず、別の選択へ移っていれば何もしない */
export const dropFilesSelectionOfAtom = appRouteStore.action(
  (route: AppRoute, path: WorkspacePath): RouteTransition<AppRoute> | null => {
    const selected = route.files.selectedRelPath;
    if (selected === null || selected.join("/") !== (toSelectedRelPath(path) ?? []).join("/")) {
      return null;
    }
    return { route: withFiles(route, { selectedRelPath: null }), replace: true };
  },
);
export const goToFilesSegmentAtom = appRouteAction(goToFilesSegment);
export const goUpFilesAtom = appRouteAction(goUpFiles);
