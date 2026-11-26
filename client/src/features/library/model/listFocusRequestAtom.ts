import { atom } from "jotai";

export interface ListFocusRequest {
  /** 登録解除した作品 */
  removedId: string;
  /** 繰り上がる隣の作品（次の行、末尾なら前の行）。無ければ null */
  neighborId: string | null;
}

/**
 * 登録解除の確定から一覧の更新までの、フォーカスの移し先の要求。一覧（useFocusListAfterReturn）だけが
 * 消費してフォーカスを移す。要求の間は一覧のコンテナがフォーカスを受けられる。
 */
export const listFocusRequestAtom = atom<ListFocusRequest | null>(null);
