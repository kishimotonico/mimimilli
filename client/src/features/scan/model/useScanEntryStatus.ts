import { useAtomValue } from "jotai";
import { useDlsiteFetchFrame } from "../../../entities/dlsite/useDlsiteJob";
import { scanModalOpenAtom } from "../../../entities/scan/model/atoms";
import { useScanning } from "../../../entities/scan/useScanJob";
import type { ScanEntryRing } from "./scanEntryRing";
import { hasUnseen, scanEntrySeenAtom } from "./scanEntrySeen";
import { useScanEntryCurrent } from "./useScanEntryCurrent";

const INACTIVE: ScanEntryRing = { kind: "none" };
const INDETERMINATE: ScanEntryRing = { kind: "indeterminate" };

/** 上のバーのスキャン入口が出す輪と点。「見た」の記憶は読むだけで、書くのは ScanRuntime が開いているあいだだけ出す ScanEntrySeenRecorder コンポーネント。 */
export function useScanEntryStatus(): { ring: ScanEntryRing; unseen: boolean } {
  const scanning = useScanning();
  const frame = useDlsiteFetchFrame();
  const open = useAtomValue(scanModalOpenAtom);
  const seen = useAtomValue(scanEntrySeenAtom);
  const current = useScanEntryCurrent();

  const ring: ScanEntryRing = scanning
    ? INDETERMINATE
    : frame.kind === "progress"
      ? { kind: "determinate", ratio: frame.total === 0 ? 0 : frame.processed / frame.total }
      : INACTIVE;

  return { ring, unseen: !open && hasUnseen(current, seen) };
}
