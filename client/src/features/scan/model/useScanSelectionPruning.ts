import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { scanCandidateSelectionAtom } from "../../../entities/scan/model/atoms";
import { useDlsiteJobState } from "../../../entities/dlsite/useDlsiteJob";
import { candidateDlsiteDisplay } from "./unregisteredDlsite";
import { pruneStaleOverrides } from "./unregisteredSelection";
import { useScanCandidatesState } from "./useScanCandidatesCache";

/** 候補と取得の状態が変わるたびに、判断が要るかどうかの食い違った選択の上書きを消す。
 *  取得はモーダルを閉じても進むので、常時マウントされる場所（ScanRuntime）から使う。 */
export function useScanSelectionPruning(): void {
  const { candidates } = useScanCandidatesState();
  const jobState = useDlsiteJobState((state) => state);
  const setSelection = useSetAtom(scanCandidateSelectionAtom);

  useEffect(() => {
    const rows = candidates.map((candidate) => ({
      candidate,
      display: candidateDlsiteDisplay(candidate, jobState),
    }));
    setSelection((previous) => pruneStaleOverrides(rows, previous));
  }, [candidates, jobState, setSelection]);
}
