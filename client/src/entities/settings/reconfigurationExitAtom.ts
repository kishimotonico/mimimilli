import { atom } from "jotai";

/** root再設定（ADR-0029）から通常運用へ戻った直後に、DLsite一括取得のattach等の
 *  離脱側後処理が必要か。突入時（自分で開始・409検知・起動時いずれも）必ずtrueにし、
 *  readyへ到達した後処理の実行後にfalseへ戻す。中間状態のrunning描画を観測できたかには
 *  依存しない。 */
export const reconfigurationExitPendingAtom = atom(false);
