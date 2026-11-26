import { atom } from "jotai";

/**
 * 登録解除した作品の ID。一覧からその作品が無くなったときに、一覧がフォーカスを移す（作品詳細ページから
 * ライブラリへ戻る場合、空になる一覧のコンテナへ移す場合）。解除の確定から一覧の更新までのあいだ、
 * 一覧のコンテナがフォーカスを受けられるようにする目印にもなる。
 */
export const listFocusRequestAtom = atom<string | null>(null);
