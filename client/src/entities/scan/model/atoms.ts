// スキャン UI の Jotai atoms。ジョブの状態は scanJobStore が持つ。

import { atom } from "jotai";
import { activeModalAtom } from "../../../shared/model/activeModalAtom";

/** ScanModal がマウント中かどうか。activeModalAtomから導出する（読み取り専用） */
export const scanModalOpenAtom = atom((get) => get(activeModalAtom)?.kind === "scan");

/** 未登録候補のうち、承認・除外操作でローカルに非表示にしたpath。サーバー由来のcandidatesクエリとは独立に持ち、
 *  再取得のタイミングに関わらず巻き戻らないようにする。 */
export const scanCandidateHiddenPathsAtom = atom<ReadonlySet<string>>(new Set<string>());
