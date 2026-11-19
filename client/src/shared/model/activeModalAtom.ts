import { atom } from "jotai";

/** アプリ全体で唯一開けるモーダルの状態。null は全て閉じている状態 */
export type ActiveModal = { kind: "settings" } | { kind: "scan" };

export const activeModalAtom = atom<ActiveModal | null>(null);
