import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  scanConflictResponseSchema,
  scanDiagnosticsResponseSchema,
  scanCandidatesMutationSchema,
  scanCandidatesRegisterRequestSchema,
  scanCandidatesRegisterResponseSchema,
  scanCandidatesResponseSchema,
  scanCandidateExclusionsResponseSchema,
  startScanRequestSchema,
  startScanResponseSchema,
  type ScanJobEvent,
  type ScanJobStatus,
} from "@mimimilli/shared";
import { CandidatePoolChangedError } from "../errors.ts";
import { ActiveScanConflictError, ScanJobManager } from "../scanJobManager.ts";
import { conflict, invalidRequest } from "../lib/httpError.ts";
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

function isTerminalStatus(status: ScanJobStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function isTerminalEvent(event: ScanJobEvent): boolean {
  return event.type === "completed" || event.type === "failed" || event.type === "cancelled";
}

export function scanRoute(
  jobs: ScanJobManager,
  heartbeatIntervalMs: number = HEARTBEAT_INTERVAL_MS,
  onCandidateRegistered: (workId: string) => void = () => {},
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

  app.get("/scan/diagnostics", async (c) => {
    const diagnostics = await jobs.listDiagnostics();
    return c.json(scanDiagnosticsResponseSchema.parse({ diagnostics }));
  });

  app.get("/scan/candidates", async (c) => {
    const candidates = await jobs.listCandidates();
    return c.json(scanCandidatesResponseSchema.parse({ candidates }));
  });

  app.post("/scan/candidates/exclude", async (c) => {
    const parsed = scanCandidatesMutationSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) invalidRequest("候補の除外内容が不正です");
    try {
      await jobs.excludeCandidates(parsed.data.paths);
    } catch (error) {
      if (error instanceof CandidatePoolChangedError) {
        conflict(error.message);
      }
      throw error;
    }
    return c.body(null, 204);
  });

  app.get("/scan/candidates/exclusions", async (c) => {
    const paths = await jobs.listCandidateExclusions();
    return c.json(scanCandidateExclusionsResponseSchema.parse({ paths }));
  });

  app.post("/scan/candidates/exclusions/restore", async (c) => {
    const parsed = scanCandidatesMutationSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) invalidRequest("候補除外の解除内容が不正です");
    await jobs.restoreCandidateExclusions(parsed.data.paths);
    return c.body(null, 204);
  });

  app.post("/scan/candidates/register", async (c) => {
    const parsed = scanCandidatesRegisterRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) invalidRequest("候補の登録内容が不正です");
    try {
      const result = await jobs.registerCandidates(parsed.data.items, onCandidateRegistered);
      return c.json(scanCandidatesRegisterResponseSchema.parse(result), 201);
    } catch (error) {
      if (error instanceof CandidatePoolChangedError) {
        conflict(error.message);
      }
      throw error;
    }
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
      let unsubscribe = (): void => {};

      // 同一接続への write を直列化する（ping とイベントの書き込みが交錯しないように）
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

      const send = (event: ScanJobEvent, closeAfter: boolean): void => {
        if (stopped) return;
        void writeSerialized({ event: event.type, data: JSON.stringify(event) }).then(() => {
          if (closeAfter) stop();
        }, stop);
      };

      const subscription = jobs.subscribe(jobId, (event) => send(event, isTerminalEvent(event)));
      if (!subscription) return;
      unsubscribe = subscription.unsubscribe;
      stream.onAbort(stop);
      send(
        { type: "state", snapshot: subscription.snapshot },
        isTerminalStatus(subscription.snapshot.status),
      );

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
