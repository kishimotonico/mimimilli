// POST /scan、GET /scan/events（TASK-20 スキャン進捗のリアルタイム通知）。
//
// POST /scan は従来どおり完了まで待って ScanResult を返す（クライアント・既存テストへの
// 互換性を壊さない）。実行中は同時に進捗イベントをジョブへ流し、GET /scan/events が
// それを SSE で配信する副チャンネルとして機能する（scanProgress.ts の状態を参照）。
//
// 接続断・再接続の挙動:
//   - スキャン実行中に SSE 接続が切れても、EventSource 標準の自動再接続で
//     GET /scan/events に再接続すれば、直近の progress イベントを1件 replay してから
//     ライブで続行する（取りこぼした細かい進捗は失われるが、最新値には追いつく）
//   - 再接続した時点でスキャンが既に完了していた場合は、直近の complete/error を
//     1件だけ replay してストリームを閉じる（進行中のスキャンが無いことをすぐ伝える）
//   - スキャンが一度も実行されていない場合は、replay するイベントが無いまま
//     ストリームを閉じる
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ScanProgressEvent } from "@mimimilli/shared";
import { NotConfiguredError, type DataAdapter } from "../adapter.ts";
import { apiError } from "../lib/httpError.ts";
import { isScanInProgress, startScanJob, subscribeToScan } from "./scanProgress.ts";

/** SSE 接続を生かし続けるための ping 間隔（ms）。walking フェーズ等、進捗が長く無音になり得るため */
const HEARTBEAT_INTERVAL_MS = 15000;

/** clearTimeout 可能な sleep。stream.sleep() は内部の setTimeout を解放できず、
 *  Promise.race で負けても発火予約が残ってプロセス終了を妨げるため自前で用意する */
function cancellableSleep(ms: number): { promise: Promise<"tick">; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<"tick">((resolve) => {
    timer = setTimeout(() => resolve("tick"), ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

export function scanRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.post("/scan", async (c) => {
    if (isScanInProgress()) {
      throw apiError("conflict", "スキャンは既に実行中です。完了をお待ちください");
    }

    const job = startScanJob();
    try {
      const result = await adapter.scan((event) => job.emit(event));
      job.emit({ type: "complete", result });
      return c.json(result);
    } catch (e) {
      const message =
        e instanceof NotConfiguredError ? e.message : "サーバー内部エラーが発生しました";
      job.emit({ type: "error", message });
      throw e;
    } finally {
      job.finish();
    }
  });

  app.get("/scan/events", (c) => {
    return streamSSE(c, async (stream) => {
      let resolveDone: () => void;
      const donePromise = new Promise<void>((resolve) => {
        resolveDone = resolve;
      });

      // 同一接続への write を直列化する（listener 発火が並んでも writeSSE 呼び出しが交錯しないように）
      let writeChain: Promise<void> = Promise.resolve();
      const enqueueWrite = (frame: { event: string; data: string }): Promise<void> => {
        writeChain = writeChain
          .then(() => stream.writeSSE(frame))
          .catch((e: unknown) => {
            console.error("SSE write に失敗しました", e);
          });
        return writeChain;
      };

      const send = (event: ScanProgressEvent) =>
        enqueueWrite({ event: event.type, data: JSON.stringify(event) });

      const listener = (event: ScanProgressEvent) => {
        const written = send(event);
        // complete/error は write 完了を待ってからストリームを閉じる（未完了での終了を防ぐ）
        if (event.type !== "progress") void written.then(() => resolveDone());
      };

      const { replay, unsubscribe, isLive } = subscribeToScan(listener);
      for (const event of replay) {
        await send(event);
      }
      const replayHasTerminal = replay.some((event) => event.type !== "progress");

      if (!isLive || replayHasTerminal) {
        unsubscribe();
        return;
      }

      stream.onAbort(() => resolveDone());

      // ライブ配信中は進捗が無い区間（walking フェーズ等）でも接続が切れないよう定期的に ping する
      let waiting = true;
      while (waiting) {
        const heartbeat = cancellableSleep(HEARTBEAT_INTERVAL_MS);
        const winner = await Promise.race([
          donePromise.then(() => "done" as const),
          heartbeat.promise,
        ]);
        heartbeat.cancel();
        if (winner === "done") {
          waiting = false;
        } else {
          await enqueueWrite({ event: "ping", data: "" });
        }
      }
      // complete/error の write 完了は listener 側で待機済みだが、直列化した write チェーンの
      // 完了を保険として待ってからストリームを閉じる
      await writeChain;
      unsubscribe();
    });
  });

  return app;
}
