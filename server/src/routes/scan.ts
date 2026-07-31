import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  scanConflictResponseSchema,
  startScanRequestSchema,
  startScanResponseSchema,
  type ScanJobEvent,
  type ScanJobStatus,
} from "@mimimilli/shared";
import { ActiveScanConflictError, ScanJobManager } from "../scanJobManager.ts";
import { invalidRequest } from "../lib/httpError.ts";
import { readOptionalJsonBody } from "../lib/jsonBody.ts";

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

function asLastEventId(value: string | undefined): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id >= 0 ? id : null;
}

function isTerminalStatus(status: ScanJobStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function isTerminalEvent(event: ScanJobEvent): boolean {
  return event.type === "completed" || event.type === "failed" || event.type === "cancelled";
}

export function scanRoute(
  jobs: ScanJobManager,
  heartbeatIntervalMs: number = HEARTBEAT_INTERVAL_MS,
): Hono {
  const app = new Hono();

  app.post("/scan", async (c) => {
    const body = await readOptionalJsonBody(c, "スキャンのリクエスト内容が不正です");
    const parsed = startScanRequestSchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("スキャンのリクエスト内容が不正です");
    }
    try {
      const job = jobs.start({ full: parsed.data.full });
      return c.json(startScanResponseSchema.parse({ job }), 202, {
        Location: `/api/scan/${job.id}`,
      });
    } catch (error) {
      if (!(error instanceof ActiveScanConflictError)) throw error;
      return c.json(
        scanConflictResponseSchema.parse({
          error: { code: "conflict", message: error.message },
          active: error.active,
        }),
        409,
      );
    }
  });

  app.get("/scan/active", (c) => {
    const job = jobs.getActive();
    return job ? c.json(job) : c.body(null, 204);
  });

  app.get("/scan/last", (c) => {
    const last = jobs.getLastCompleted();
    return last ? c.json(last) : c.body(null, 204);
  });

  app.get("/scan/:id", (c) => {
    const job = jobs.get(c.req.param("id"));
    return job
      ? c.json(job)
      : c.json({ error: { code: "not_found", message: "スキャンジョブが見つかりません" } }, 404);
  });

  app.delete("/scan/:id", (c) => {
    const job = jobs.cancel(c.req.param("id"));
    return job
      ? c.json(job)
      : c.json({ error: { code: "not_found", message: "スキャンジョブが見つかりません" } }, 404);
  });

  app.get("/scan/:id/events", (c) => {
    const jobId = c.req.param("id");
    if (!jobs.get(jobId)) {
      return c.json(
        { error: { code: "not_found", message: "スキャンジョブが見つかりません" } },
        404,
      );
    }
    return streamSSE(c, async (stream) => {
      let resolveDone!: () => void;
      const done = new Promise<void>((resolve) => {
        resolveDone = resolve;
      });
      let stopped = false;
      let writing = false;
      let closeWhenDrained = false;
      let replayBoundarySeq = 0;
      const queue: ScanJobEvent[] = [];
      let unsubscribe = (): void => {};

      // 同一接続への write を直列化する（ping と pump のイベント書き込みが交錯しないように）
      let writeChain: Promise<void> = Promise.resolve();
      const writeSerialized = (frame: {
        event: string;
        id?: string;
        data: string;
      }): Promise<void> => {
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

      const pump = async (): Promise<void> => {
        if (writing || stopped) return;
        writing = true;
        try {
          while (!stopped && queue.length > 0) {
            const event = queue.shift()!;
            await writeSerialized({
              event: event.type,
              id: String(event.seq),
              data: JSON.stringify(event),
            });
            if (isTerminalEvent(event)) stop();
          }
          if (!stopped && closeWhenDrained && queue.length === 0) stop();
        } catch {
          stop();
        } finally {
          writing = false;
        }
      };

      const enqueue = (event: ScanJobEvent): void => {
        if (stopped) return;
        if (event.type === "progress") {
          let pendingIndex = -1;
          for (let index = queue.length - 1; index >= 0; index--) {
            const queued: ScanJobEvent = queue[index]!;
            if (queued.type === "progress" && queued.seq > replayBoundarySeq) {
              pendingIndex = index;
              break;
            }
          }
          if (pendingIndex >= 0) queue[pendingIndex] = event;
          else queue.push(event);
        } else {
          if (isTerminalEvent(event)) {
            for (let index = queue.length - 1; index >= 0; index--) {
              if (queue[index]!.type === "progress" && queue[index]!.seq > replayBoundarySeq) {
                queue.splice(index, 1);
              }
            }
          }
          queue.push(event);
        }
        void pump();
      };

      const subscription = jobs.subscribe(
        jobId,
        asLastEventId(c.req.header("Last-Event-ID")),
        enqueue,
      );
      if (!subscription) return;
      unsubscribe = subscription.unsubscribe;
      replayBoundarySeq = subscription.initial.at(-1)?.seq ?? 0;
      closeWhenDrained =
        isTerminalStatus(subscription.snapshot.status) &&
        !subscription.initial.some(isTerminalEvent);
      stream.onAbort(stop);
      for (const event of subscription.initial) enqueue(event);

      if (isTerminalStatus(subscription.snapshot.status) && subscription.initial.length === 0) {
        stop();
      }

      // ライブ配信中は進捗が無い区間（walking フェーズ等）でも接続が切れないよう定期的に ping する。
      // done 解決時は必ずタイマーを clear してから抜けるため、残留タイマーは残らない。
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
    });
  });

  return app;
}
