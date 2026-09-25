import type { createStore } from "jotai";
import type { AppRoute } from "../../src/entities/navigation/model/appRoute";
import type {
  FilesUrlState,
  LibraryUrlState,
} from "../../src/entities/navigation/model/navigationUrl";
import { appRouteStore } from "../../src/entities/navigation/model/appRouteStore";

type Store = ReturnType<typeof createStore>;

/** テストの前提となる route を置く。URLへ反映済みの状態として、未反映の履歴要求は残さない */
export function seedRoute(store: Store, update: (route: AppRoute) => AppRoute): void {
  store.set(appRouteStore.navigateAtom, update, { replace: true });
  store.set(appRouteStore.sync.consumePendingWriteAtom);
}

export function seedLibraryRoute(store: Store, patch: Partial<LibraryUrlState>): void {
  seedRoute(store, (route) => ({ ...route, library: { ...route.library, ...patch } }));
}

export function seedFilesRoute(store: Store, patch: Partial<FilesUrlState>): void {
  seedRoute(store, (route) => ({ ...route, files: { ...route.files, ...patch } }));
}

export function seedAppMode(
  store: Store,
  mode: Exclude<AppRoute["mode"], "workDetail"> | { workDetail: string },
): void {
  seedRoute(store, ({ library, files }) =>
    typeof mode === "string"
      ? { mode, library, files }
      : { mode: "workDetail", workId: mode.workDetail, library, files },
  );
}
