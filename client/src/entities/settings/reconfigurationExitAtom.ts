import { atom } from "jotai";

/** root再設定（ADR-0029）から通常運用へ戻った直後に、DLsite一括取得のattach等の
 *  離脱側後処理が必要か。突入検知とRootReconfigurationDriftEffectのdrift検知の
 *  たびインクリメントする単調増加のepoch（0は「未処理の要求なし」）。boolean flagだと
 *  ready常駐中に2回目以降の要求が立ってもtrue→trueで値が変わらず取りこぼすため、
 *  毎回必ず別の値にする（ReconfigurationExitEffect参照）。 */
export const reconfigurationExitEpochAtom = atom(0);
