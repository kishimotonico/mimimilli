import { atom } from "jotai";
import { relativeToRoot, workspacePath, type WorkspacePath } from "@mimimilli/shared";
import type { RouteTransition } from "../../../shared/model/routeStore";
import type { AppRoute } from "../../navigation/model/appRoute";
import { appRouteAtom, appRouteStore } from "../../navigation/model/appRouteStore";

/** カレントディレクトリのルート相対 segments（[] = ルート） */
export const filesRelPathAtom = atom((get) => get(appRouteAtom).files.relPath);

/** 選択中エントリ（ファイル or dir）の WorkspacePath。プレビュー対象 */
export const filesSelectedPathAtom = atom<WorkspacePath | null>((get) => {
  const { selectedRelPath } = get(appRouteAtom).files;
  return selectedRelPath ? workspacePath(selectedRelPath.join("/")) : null;
});

export function toSelectedRelPath(path: string | null): string[] | null {
  return path ? path.split("/") : null;
}

export interface OpenPathInFilesArgs {
  /** ライブラリルート絶対パス（root相対のportable pathでも渡してよい。relativeToRootは
   *  すでにroot相対な入力に対しては素通りする） */
  path: string;
  /** ライブラリルートの絶対パス（settings.rootFolder） */
  root: string;
}

/** 絶対パス・root相対パスのどちらで渡されてもFilesモードで開き、当該エントリを選択する
 *  （要対応タブ・エラー作品の「Filesで開く」導線が共有する）。 */
export function openPathInFiles(
  route: AppRoute,
  { path, root }: OpenPathInFilesArgs,
): RouteTransition<AppRoute> {
  const relativePath = relativeToRoot(path, root);
  const segments = relativePath.split("/").filter(Boolean);
  return {
    route: {
      mode: "files",
      library: route.library,
      files: { relPath: segments.slice(0, -1), selectedRelPath: toSelectedRelPath(relativePath) },
    },
  };
}

export const openPathInFilesAtom = appRouteStore.action(openPathInFiles);
