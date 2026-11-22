import type { createStore } from "jotai";
import type { AppRoute, LibraryRoute } from "../../src/entities/navigation/model/appRoute";
import type { FilesUrlState } from "../../src/entities/navigation/model/navigationUrl";
import { appRouteStore } from "../../src/entities/navigation/model/appRouteStore";

type Store = ReturnType<typeof createStore>;

/** テストの前提となる route を置く。URLへ反映済みの状態として、未反映の履歴要求は残さない */
export function seedRoute(store: Store, update: (route: AppRoute) => AppRoute): void {
  store.set(appRouteStore.navigateAtom, update, { replace: true });
  store.set(appRouteStore.sync.takePendingOpsAtom);
}

export function seedLibraryRoute(store: Store, patch: Partial<LibraryRoute>): void {
  seedRoute(store, (route) => ({ ...route, library: { ...route.library, ...patch } }));
}

export function seedFilesRoute(store: Store, patch: Partial<FilesUrlState>): void {
  seedRoute(store, (route) => ({ ...route, files: { ...route.files, ...patch } }));
}

export function seedAppMode(
  store: Store,
  mode: Exclude<AppRoute["mode"], "workDetail"> | { workDetail: string },
): void {
  seedRoute(store, ({ library, files, layer }) =>
    typeof mode === "string"
      ? { mode, library, files, layer }
      : { mode: "workDetail", workId: mode.workDetail, library, files, layer },
  );
}

/** 履歴へ未反映の操作の種類を、navigate が呼ばれた順に返す（同期が無いテストで列の中身を確かめる） */
export function pendingWrites(store: Store): string[] {
  return store.get(appRouteStore.sync.pendingOpsAtom).map((op) => op.write);
}

/** 未反映の操作を捨てる */
export function clearPendingOps(store: Store): void {
  store.set(appRouteStore.sync.takePendingOpsAtom);
}
