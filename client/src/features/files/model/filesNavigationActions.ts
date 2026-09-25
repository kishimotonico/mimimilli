import type { WorkspacePath } from "@mimimilli/shared";
import type { RouteTransition } from "../../../shared/model/routeStore";
import type { AppRoute } from "../../../entities/navigation/model/appRoute";
import type { FilesUrlState } from "../../../entities/navigation/model/navigationUrl";
import { appRouteStore } from "../../../entities/navigation/model/appRouteStore";
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

export const openFilesDirAtom = appRouteStore.action(openFilesDir);
export const selectFilesEntryAtom = appRouteStore.action(selectFilesEntry);
export const clearFilesSelectionAtom = appRouteStore.action(clearFilesSelection);
export const goToFilesSegmentAtom = appRouteStore.action(goToFilesSegment);
export const goUpFilesAtom = appRouteStore.action(goUpFiles);
