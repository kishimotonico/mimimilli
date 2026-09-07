import { atom } from "jotai";

/** 絶対パスコピー成功時のトーストメッセージ（GlobalToastが表示する） */
export const copyPathSuccessAtom = atom<string | null>(null);
