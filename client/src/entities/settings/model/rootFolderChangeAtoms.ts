import { atom } from "jotai";

/** ルートフォルダー変更が保存された時刻（ISO）。settings.lastScanTime がこれより新しくなるまで、
 *  一覧は変更前フォルダーの内容のままであることを示すのに使う（TASK-428.6）。 */
export const rootFolderChangedAtAtom = atom<string | null>(null);

/** ルートフォルダー変更成功直後のトースト表示フラグ。actionから直接スキャンモーダルを開ける */
export const rootFolderChangedToastAtom = atom(false);
