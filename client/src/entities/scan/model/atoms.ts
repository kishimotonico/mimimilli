// スキャン UI の Jotai atoms。ジョブの状態は scanJobStore が持つ。

import { atom, type createStore } from "jotai";
import { activeModalAtom } from "../../../shared/model/activeModalAtom";

/** ScanModal がマウント中かどうか。activeModalAtomから導出する（読み取り専用） */
export const scanModalOpenAtom = atom((get) => get(activeModalAtom)?.kind === "scan");

/** スキャン完了後に、記録・要対応・候補のキャッシュが最新になるたびに増える。開いているモーダルが着地タブを選び直す合図 */
export const scanResultsRefreshedAtom = atom(0);

/** 未登録候補の選択の上書き。キーに無い候補は、その行の既定（判断が要る行は選ばず、それ以外は選ぶ）に従う。
 *  judgments・rjCode は上書きしたときの行の状態。今の行に新しい判断の理由が出たり（取得で該当なし・失敗になった、取り直して再び失敗した）、RJコードが変わったりすれば、上書きは採らず既定に戻る。
 *  モーダルを閉じても、候補から消えても残す（除外して戻した候補の選択が保たれる）。 */
export interface ScanCandidateSelectionOverride {
  selected: boolean;
  /** 上書きしたときの判断が要る理由。要らなければ空 */
  judgments: readonly string[];
  /** 上書きしたときのRJコード */
  rjCode: string | null;
}
export const scanCandidateSelectionAtom = atom<ReadonlyMap<string, ScanCandidateSelectionOverride>>(
  new Map(),
);

type JotaiStore = ReturnType<typeof createStore>;

/** 候補のローカル状態（選択）を捨てる。root再設定で候補の集合が入れ替わるときに使う。 */
export function clearScanCandidateLocalState(store: JotaiStore): void {
  store.set(scanCandidateSelectionAtom, new Map());
}
