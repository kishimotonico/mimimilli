import { useDelayedLoading } from "../../../../shared/ui/useDelayedLoading";
import type { ScanListStatus } from "../../model/scanListStatus";

/** pending は loading になって間もなく、まだ何も描かない期間 */
export type DisplayedScanListStatus = ScanListStatus | "pending";

/** 生の status に、loading の遅延表示と最低表示時間を反映した表示用の status を返す。 */
export function useDisplayedScanListStatus(status: ScanListStatus): DisplayedScanListStatus {
  const loading = useDelayedLoading(status === "loading");
  if (loading === "visible") return "loading";
  return loading === "pending" ? "pending" : status;
}
