// スキャン UI の Jotai atoms。ジョブの状態は scanJobStore が持つ。

import { atom, type createStore } from "jotai";
import { activeModalAtom } from "../../../shared/model/activeModalAtom";

/** ScanModal がマウント中かどうか。activeModalAtomから導出する（読み取り専用） */
export const scanModalOpenAtom = atom((get) => get(activeModalAtom)?.kind === "scan");

/** 未登録候補のうち、承認・除外操作でローカルに非表示にしたpath。サーバー由来のcandidatesクエリとは独立に持ち、
 *  再取得のタイミングに関わらず巻き戻らないようにする。 */
export const scanCandidateHiddenPathsAtom = atom<ReadonlySet<string>>(new Set<string>());

/** 未登録候補のうち、選択から外したpath。既定は全選択で、新しく現れた候補は選択された状態で入る。
 *  モーダルを閉じても残す（開き直しで全選択に戻り、外した候補まで追加されるのを防ぐ）。 */
export const scanCandidateDeselectedPathsAtom = atom<ReadonlySet<string>>(new Set<string>());

type JotaiStore = ReturnType<typeof createStore>;

/** 候補のローカル状態（非表示・選択）を捨てる。root再設定で候補の集合が入れ替わるときに使う。 */
export function clearScanCandidateLocalState(store: JotaiStore): void {
  store.set(scanCandidateHiddenPathsAtom, new Set());
  store.set(scanCandidateDeselectedPathsAtom, new Set());
}
