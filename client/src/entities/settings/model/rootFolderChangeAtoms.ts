import { atom } from "jotai";

/** ルートフォルダー変更成功直後のトースト表示フラグ。actionから直接スキャンモーダルを開ける。
 *  一過性の事象通知であり、状態の判定根拠ではないためクライアントのメモリで持ってよい。 */
export const rootFolderChangedToastAtom = atom(false);
