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
      let json: unknown;
      try {
        json = JSON.parse(e.data);
      } catch (err) {
        console.error("スキャン進捗イベントのJSON解析に失敗しました", err, e.data);
        return;
      }
      const parsed = scanProgressEventSchema.safeParse(json);
      if (!parsed.success) {
        console.error("スキャン進捗イベントのスキーマ検証に失敗しました", parsed.error);
        return;
      }
      if (parsed.data.type !== "progress") return;
      const { phase, processed, total } = parsed.data;
      setProgress({ phase, processed, total });
    };

    // EventSource の接続エラーと名前付き SSE の "error" イベントは、ブラウザ上どちらも
    // type: "error" の Event として同じハンドラーに配送される。名前付きイベントは
    // data を持つ MessageEvent、接続エラーは data を持たない素の Event で区別できる。
    // 接続エラーで JSON.parse(undefined) を呼ぶと未処理例外になるため、ここで分岐する。
    const handleErrorEvent = (e: Event) => {
      if (e instanceof MessageEvent) {
        handleEvent(e);
        return;
      }
      console.error("スキャン進捗のSSE接続でエラーが発生しました", e);
    };

    source.addEventListener("progress", handleEvent);
    source.addEventListener("complete", handleEvent);
    source.addEventListener("error", handleErrorEvent);

    return () => {
      source.close();
    };
  }, [active]);

  return progress;
}
