// GET /api/scan/events を EventSource で購読し、スキャン進捗をリアルタイムに表示するためのフック。
//
// 接続ライフサイクル（都度接続方式）: active（スキャン中かどうか）に連動して接続を開閉する。
// 常時接続はしない — スキャンをしていない間は誰も見ていない進捗チャンネルを維持するコストが
// 無駄なため、POST /scan が実行中の間だけ接続する設計にしている。
//
// 接続断・再接続: EventSource は標準で自動再接続する（ブラウザ組み込み、既定リトライ間隔）。
// 再接続後はサーバー側が直近の progress を1件 replay するため（server/src/routes/scan.ts）、
// このフックは特別な再接続処理をせず、届いたイベントをそのまま反映するだけでよい。
// complete/error イベント自体は POST /scan の Promise（呼び出し側の useMutation）が処理するため、
// ここでは progress の表示状態の更新のみを担う。
import { useEffect, useState } from "react";
import { scanProgressEventSchema } from "@mimimilli/shared";
import { API_BASE } from "../../shared/api/http";
import type { ScanProgress } from "./model";

export function useScanProgress(active: boolean): ScanProgress | null {
  const [progress, setProgress] = useState<ScanProgress | null>(null);

  useEffect(() => {
    if (!active) {
      setProgress(null);
      return;
    }

    const source = new EventSource(`${API_BASE}/scan/events`);

    const handleEvent = (e: MessageEvent<string>) => {
      const parsed = scanProgressEventSchema.safeParse(JSON.parse(e.data));
      if (!parsed.success || parsed.data.type !== "progress") return;
      const { phase, processed, total } = parsed.data;
      setProgress({ phase, processed, total });
    };

    source.addEventListener("progress", handleEvent);
    source.addEventListener("complete", handleEvent);
    source.addEventListener("error", handleEvent);

    return () => {
      source.close();
    };
  }, [active]);

  return progress;
}
