import { useEffect, useRef, useState } from "react";

/** 完了サインの表示時間。派手にしないため短めに留める。 */
const COMPLETION_HINT_MS = 2400;

/** 実行中→完了の遷移を自分で見ていたときだけ、控えめな完了サインを一時的に出す
 *  （レイアウトは動かさず、左リストの最終スキャン行のテキストだけを使う）。 */
export function useScanCompletionHint(scanning: boolean) {
  const [justCompleted, setJustCompleted] = useState(false);
  const wasScanningRef = useRef(scanning);
  useEffect(() => {
    const wasScanning = wasScanningRef.current;
    wasScanningRef.current = scanning;
    if (!(wasScanning && !scanning)) return;
    setJustCompleted(true);
    const hintTimer = setTimeout(() => setJustCompleted(false), COMPLETION_HINT_MS);
    return () => clearTimeout(hintTimer);
  }, [scanning]);

  const wasScanning = wasScanningRef.current;
  const justStoppedScanning = wasScanning && !scanning;

  return { showCompletedHint: justCompleted || justStoppedScanning };
}
