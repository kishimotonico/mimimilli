import { useEffect, useState } from "react";
import { useScanJobState, useScanJobStore } from "../../../../entities/scan/useScanJob";
import { deriveScanStatusView, type ScanStatusView } from "../../model/scanStatusView";

/** 完了の表示時間。派手にしないため短めに留める。 */
const COMPLETED_VIEW_MS = 2400;

/** ジョブのsnapshotから状態欄の表示を決める。完了は、終端を見届けたときだけ短く出す。 */
export function useScanStatusView(lastScanTime: string | null): ScanStatusView {
  const store = useScanJobStore();
  const job = useScanJobState((state) => state.job);
  const [completedJobId, setCompletedJobId] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = store.subscribeEvents((event) => {
      if (event.type !== "terminal" || event.job.status !== "completed") return;
      clearTimeout(timer);
      setCompletedJobId(event.job.id);
      timer = setTimeout(() => setCompletedJobId(null), COMPLETED_VIEW_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [store]);

  return deriveScanStatusView(job, lastScanTime, job !== null && job.id === completedJobId);
}
