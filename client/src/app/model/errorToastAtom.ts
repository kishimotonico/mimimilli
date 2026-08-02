import { atom } from "jotai";

/** アプリ全体の汎用エラートースト（GlobalToast が表示） */
export const errorToastAtom = atom<string | null>(null);
