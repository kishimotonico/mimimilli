import { atom } from "jotai";

/** root再設定（ADR-0029）から通常運用へ戻った直後に、DLsite一括取得のattach等の
 *  離脱側後処理が必要か。突入検知・409観測のたびインクリメントする単調増加の epoch。
 *  0は「未処理の要求なし」を表す。boolean flagではなくepochにしているのは、
 *  ready常駐中に2回目以降のdrift/409が立ってもtrue→trueの変化なし（onQueryUpdate自体は
 *  起きても値としては変わらない）扱いにならないよう、毎回必ず別の値にして取りこぼさない
 *  ため（ReconfigurationExitEffect参照）。 */
export const reconfigurationExitEpochAtom = atom(0);
