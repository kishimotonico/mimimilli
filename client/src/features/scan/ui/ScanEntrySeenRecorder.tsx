import { useEffect } from "react";
import { useAtom } from "jotai";
import { nextSeen, scanEntrySeenAtom } from "../model/scanEntrySeen";
import { useScanEntryCurrent } from "../model/useScanEntryCurrent";

/** スキャン画面を開いているあいだだけマウントし、見えている項目を「見た」として記憶する。 */
export default function ScanEntrySeenRecorder() {
  const current = useScanEntryCurrent();
  const [seen, setSeen] = useAtom(scanEntrySeenAtom);

  useEffect(() => {
    const next = nextSeen(seen, current);
    if (next !== seen) setSeen(next);
  }, [seen, current, setSeen]);

  return null;
}
