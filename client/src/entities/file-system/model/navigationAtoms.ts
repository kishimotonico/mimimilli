import { atom } from "jotai";
import { workspacePath } from "@mimimilli/shared";
import { setAppModeAtom } from "../../../shared/model/appModeAtoms";
import type { WorkspacePath } from "@mimimilli/shared";

/** カレントディレクトリのルート相対 segments（[] = ルート） */
export const filesRelPathAtom = atom<string[]>([]);

/** 選択中エントリ（ファイル or dir）の WorkspacePath。プレビュー対象 */
export const filesSelectedPathAtom = atom<WorkspacePath | null>(null);

/** カラム遷移方向（1 = 子へ潜る / -1 = 親へ遡る）。アニメーションの向きに使う */
export const filesDirectionAtom = atom<1 | -1>(1);

/** ルート相対の絶対パスをFilesモードで開き、当該エントリを選択する
 *  （要対応タブ・エラー作品の「Filesで開く」導線が共有する）。 */
export const openPathInFilesAtom = atom(null, (_get, set, path: string) => {
  const segments = path.split("/").filter(Boolean);
  const directory = segments.slice(0, -1);
  set(setAppModeAtom, "files");
  set(filesRelPathAtom, directory);
  set(filesSelectedPathAtom, workspacePath(path));
});
