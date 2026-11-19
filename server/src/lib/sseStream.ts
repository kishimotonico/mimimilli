import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

/** SSE接続を生かし続けるpingの間隔（ms）。無音が続くとBunのidleTimeoutで切れるため */
export const SSE_HEARTBEAT_INTERVAL_MS = 15000;

export interface SseSubscription<E> {
  /** 接続直後に順に送るイベント。購読の登録と同じ同期の1手で取得したもの */
  replay: E[];
  /** falseならreplayを送ったあと接続を閉じる */
  live: boolean;
  unsubscribe(): void;
}

export interface SseSource<E extends { type: string }> {
  subscribe(listener: (event: E) => void): SseSubscription<E>;
  /** このイベントを送ったあとに接続を閉じる */
  isTerminal(event: E): boolean;
}

/** clearTimeout可能なsleep。stream.sleepは発火予約を解放できずプロセス終了を妨げる */
function cancellableSleep(ms: number): { promise: Promise<"tick">; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<"tick">((resolve) => {
    timer = setTimeout(() => resolve("tick"), ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

/**
 * ジョブ進捗のSSE配信。書き込みの直列化・購読解除・終端での切断・pingを受け持つ。
 * イベント名は `type`、データはイベントのJSON。
 */
export function streamJobEvents<E extends { type: string }>(
  c: Context,
  source: SseSource<E>,
  heartbeatIntervalMs: number = SSE_HEARTBEAT_INTERVAL_MS,
): Response {
  return streamSSE(c, async (stream) => {
    let resolveDone!: () => void;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    let stopped = false;
    let unsubscribe = (): void => {};
    let writeChain: Promise<void> = Promise.resolve();

    const writeSerialized = (frame: { event: string; data: string }): Promise<void> => {
      const next = writeChain.then(() => stream.writeSSE(frame));
      writeChain = next.then(
        () => {},
        () => {},
      );
      return next;
    };

    const stop = (): void => {
      if (stopped) return;
      stopped = true;
      unsubscribe();
      resolveDone();
    };

    const send = (event: E, closeAfter: boolean): void => {
      if (stopped) return;
      void writeSerialized({ event: event.type, data: JSON.stringify(event) }).then(() => {
        if (closeAfter) stop();
      }, stop);
    };

    try {
      stream.onAbort(stop);
      const subscription = source.subscribe((event) => send(event, source.isTerminal(event)));
      unsubscribe = subscription.unsubscribe;
      for (const event of subscription.replay) send(event, false);
      if (!subscription.live) {
        void writeChain.then(stop);
      }

      const heartbeat = async (): Promise<void> => {
        while (!stopped) {
          const sleep = cancellableSleep(heartbeatIntervalMs);
          const winner = await Promise.race([done.then(() => "done" as const), sleep.promise]);
          sleep.cancel();
          if (winner === "done") return;
          try {
            await writeSerialized({ event: "ping", data: "" });
          } catch {
            stop();
            return;
          }
        }
      };

      await Promise.all([done, heartbeat()]);
      await writeChain;
    } finally {
      unsubscribe();
    }
  });
}
