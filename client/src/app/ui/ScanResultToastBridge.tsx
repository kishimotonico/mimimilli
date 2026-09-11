import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { scanResultToastAtom } from "../../entities/scan/model/atoms";
import { formatScanResult } from "../../features/scan/model/formatScanResult";
import { activeModalAtom } from "../../shared/model/activeModalAtom";
import { useToast } from "../../shared/ui/useToast";

// ScanRuntime（entities/scan配下、スキャンモーダルのタブ状態を知らない）がセットする
// scanResultToastAtomを一度きりの信号として消費し、useToastの表示要求へ変換する。
// App.tsxはJotaiの読み取りAPI・features/*/model配下を直接importしない方針
// （.oxlintrc.json）のため、この変換をapp/ui配下の小さな橋渡しコンポーネントに閉じる。
export default function ScanResultToastBridge() {
  const scanResultToast = useAtomValue(scanResultToastAtom);
  const setScanResultToast = useSetAtom(scanResultToastAtom);
  const setActiveModal = useSetAtom(activeModalAtom);
  const toast = useToast();

  useEffect(() => {
    if (!scanResultToast) return;
    setScanResultToast(null);
    if (scanResultToast.kind === "cancelled") {
      toast.show({ message: "スキャンを中止しました", variant: "warning", priority: "notice" });
      return;
    }
    const { result } = scanResultToast;
    const hasNeedsAttention =
      result.identityConflicts.length > 0 ||
      result.invalidMetaFiles.length > 0 ||
      result.rjCodeMissingCount > 0 ||
      result.dataIntegrityWarning !== undefined;
    toast.show({
      message: `スキャン完了: ${formatScanResult(result)}`,
      variant: result.errors > 0 || result.missing > 0 ? "warning" : "success",
      priority: "notice",
      actionLabel: hasNeedsAttention ? "要対応を見る" : undefined,
      // onActionはトーストを自動では閉じない契約（design-system.md）。ここは同期的に
      // 完結する操作なので押した直後に閉じる
      onAction: hasNeedsAttention
        ? () => {
            setActiveModal({ kind: "scan", tab: "needsAttention" });
            toast.dismiss();
          }
        : undefined,
    });
  }, [scanResultToast, setScanResultToast, setActiveModal, toast]);

  return null;
}
