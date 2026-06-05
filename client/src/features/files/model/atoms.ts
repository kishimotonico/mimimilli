// files feature の client/UI state。
// 物理FSの現在地（ルート相対 segments）と選択中エントリを Jotai atom で管理する。
// ルート絶対パスは settings 由来（server state）のためここには置かず、フック側で結合する。

import { atom } from "jotai";

/** カレントディレクトリのルート相対 segments（[] = ルート） */
export const filesRelPathAtom = atom<string[]>([]);

/** 選択中エントリ（ファイル or dir）の絶対パス。プレビュー対象 */
export const filesSelectedPathAtom = atom<string | null>(null);

/** カラム遷移方向（1 = 子へ潜る / -1 = 親へ遡る）。アニメーションの向きに使う */
export const filesDirectionAtom = atom<1 | -1>(1);
