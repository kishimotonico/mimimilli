import { atom } from "jotai";

export interface FocusListOnReturn {
  /** 解除した作品の次の作品（末尾なら前の作品）。無ければ null */
  neighborId: string | null;
}

/**
 * 作品詳細ページ（一覧が描画されない）で登録解除したあと、ライブラリへ戻って一覧が描画されたら、
 * 一覧が一度だけフォーカスを受け取る要求。移し先の行は、解除の確定時に決めて持ち帰る。
 */
export const focusListOnReturnAtom = atom<FocusListOnReturn | null>(null);
