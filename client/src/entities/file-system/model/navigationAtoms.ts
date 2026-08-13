import { atom } from "jotai";
import type { WorkspacePath } from "@mimimilli/shared";

/** カレントディレクトリのルート相対 segments（[] = ルート） */
export const filesRelPathAtom = atom<string[]>([]);

/** 選択中エントリ（ファイル or dir）の WorkspacePath。プレビュー対象 */
export const filesSelectedPathAtom = atom<WorkspacePath | null>(null);

/** カラム遷移方向（1 = 子へ潜る / -1 = 親へ遡る）。アニメーションの向きに使う */
export const filesDirectionAtom = atom<1 | -1>(1);
