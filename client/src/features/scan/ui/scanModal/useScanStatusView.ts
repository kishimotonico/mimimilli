import { useEffect, useRef, useState } from "react";
import { useScanJobState } from "../../../../entities/scan/useScanJob";
import { isTerminalScanJob } from "../../../../entities/scan/model/scanJob";
import { deriveScanStatusView, type ScanStatusView } from "../../model/scanStatusView";

/** 完了の表示時間。派手にしないため短めに留める。 */
const COMPLETED_VIEW_MS = 2400;

/** ジョブのsnapshotから状態欄の表示を決める。完了は、このモーダルが終端を見届けたときだけ短く出す。 */
export function useScanStatusView(lastScanTime: string | null): ScanStatusView {
  const job = useScanJobState((state) => state.job);
  const [completedJobId, setCompletedJobId] = useState<string | null>(null);
  const previousRef = useRef(job);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = job;
    if (job?.status !== "completed") return;
    const observedTransition = previous?.id !== job.id || !isTerminalScanJob(previous);
    if (!observedTransition) return;
    setCompletedJobId(job.id);
    const timer = setTimeout(() => setCompletedJobId(null), COMPLETED_VIEW_MS);
    return () => clearTimeout(timer);
  }, [job]);

  return deriveScanStatusView(job, lastScanTime, job !== null && job.id === completedJobId);
}
