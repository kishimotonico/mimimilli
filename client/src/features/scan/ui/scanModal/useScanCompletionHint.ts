import { useEffect, useRef, useState } from "react";
import type { ScanResult } from "@mimimilli/shared";
import { STAT_KEYS, type StatKey } from "./StatsGrid";

/** 完了サインの表示時間。派手にしないため短めに留める。 */
const COMPLETION_HINT_MS = 2400;
/** 変化したバッジの強調が消えるまでの時間（バッジ側のtransition-colorsで滑らかに戻す）。 */
const BADGE_HIGHLIGHT_MS = 1000;

/** 実行中→完了の遷移を自分で見ていたときだけ、控えめな完了サインを一時的に出す
 *  （レイアウトは動かさず、ステータス行のテキストと変化した統計バッジの色だけを使う）。 */
export function useScanCompletionHint(scanning: boolean, lastResult: ScanResult | null) {
  const [justCompleted, setJustCompleted] = useState(false);
  const [changedKeys, setChangedKeys] = useState<ReadonlySet<StatKey>>(new Set());
  const wasScanningRef = useRef(scanning);
  const resultBeforeRunRef = useRef(lastResult);
  useEffect(() => {
    const wasScanning = wasScanningRef.current;
    wasScanningRef.current = scanning;
    if (!wasScanning && scanning) {
      resultBeforeRunRef.current = lastResult;
      return;
    }
    if (!(wasScanning && !scanning)) return;
    const before = resultBeforeRunRef.current;
    const changed = new Set<StatKey>(
      STAT_KEYS.filter((key) => (before?.[key] ?? 0) !== (lastResult?.[key] ?? 0)),
    );
    setChangedKeys(changed);
    setJustCompleted(true);
    const hintTimer = setTimeout(() => setJustCompleted(false), COMPLETION_HINT_MS);
    const badgeTimer = setTimeout(() => setChangedKeys(new Set()), BADGE_HIGHLIGHT_MS);
    return () => {
      clearTimeout(hintTimer);
      clearTimeout(badgeTimer);
    };
  }, [scanning, lastResult]);

  const wasScanning = wasScanningRef.current;
  const justStoppedScanning = wasScanning && !scanning;

  return { showCompletedHint: justCompleted || justStoppedScanning, changedKeys };
}
