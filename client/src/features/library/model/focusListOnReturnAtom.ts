import { atom } from "jotai";

/**
 * 作品詳細ページ（一覧が描画されない）で登録解除したあと、ライブラリへ戻って一覧が描画されたら、
 * 一覧が一度だけフォーカスを受け取る要求。
 */
export const focusListOnReturnAtom = atom(false);
