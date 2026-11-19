import { Hono } from "hono";
import {
  scanConflictResponseSchema,
  scanDiagnosticsSchema,
  scanRecordSchema,
  scanCandidatesMutationSchema,
  scanCandidatesRegisterRequestSchema,
  scanCandidatesRegisterResponseSchema,
  scanCandidatesResponseSchema,
  scanCandidateRjCodeRequestSchema,
  scanCandidateRjCodeResponseSchema,
  scanCandidateExclusionsResponseSchema,
  startScanRequestSchema,
  startScanResponseSchema,
  type ScanJobEvent,
  type ScanJobStatus,
} from "@mimimilli/shared";
import { CandidatePoolChangedError } from "../errors.ts";
import { ActiveScanConflictError, ScanJobManager } from "../scanJobManager.ts";
import { conflict } from "../lib/httpError.ts";
import { streamJobEvents, SSE_HEARTBEAT_INTERVAL_MS } from "../lib/sseStream.ts";
import { readJsonBody, readOptionalJsonBody } from "../lib/jsonBody.ts";

function isTerminalStatus(status: ScanJobStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function isTerminalEvent(event: ScanJobEvent): boolean {
  return event.type === "completed" || event.type === "failed" || event.type === "cancelled";
}

export function scanRoute(
  jobs: ScanJobManager,
  heartbeatIntervalMs: number = SSE_HEARTBEAT_INTERVAL_MS,
): Hono {
  const app = new Hono();

  app.post("/scan", async (c) => {
    const data = await readOptionalJsonBody(
      c,
      startScanRequestSchema,
      "スキャンのリクエスト内容が不正です",
    );
    try {
      const job = jobs.start({ full: data.full });
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
    return c.json(scanRecordSchema.parse(jobs.record.snapshot()));
  });

  app.get("/scan/diagnostics", async (c) => {
    const diagnostics = await jobs.listDiagnostics();
    return c.json(scanDiagnosticsSchema.parse(diagnostics));
  });

  app.get("/scan/candidates", async (c) => {
    const candidates = await jobs.listCandidates();
    return c.json(scanCandidatesResponseSchema.parse({ candidates }));
  });

  app.post("/scan/candidates/rj-code", async (c) => {
    const data = await readJsonBody(
      c,
      scanCandidateRjCodeRequestSchema,
      "候補のRJコードの内容が不正です",
    );
    try {
      const candidate = await jobs.setCandidateRjCode(data.path, data.rjCode || null);
      return c.json(scanCandidateRjCodeResponseSchema.parse({ candidate }));
    } catch (error) {
      if (error instanceof CandidatePoolChangedError) {
        conflict(error.message);
      }
      throw error;
    }
  });

  app.post("/scan/candidates/exclude", async (c) => {
    const data = await readJsonBody(c, scanCandidatesMutationSchema, "候補の除外内容が不正です");
    try {
      await jobs.excludeCandidates(data.paths);
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
    const data = await readJsonBody(
      c,
      scanCandidatesMutationSchema,
      "候補除外の解除内容が不正です",
    );
    await jobs.restoreCandidateExclusions(data.paths);
    return c.body(null, 204);
  });

  app.post("/scan/candidates/register", async (c) => {
    const data = await readJsonBody(
      c,
      scanCandidatesRegisterRequestSchema,
      "候補の登録内容が不正です",
    );
    try {
      const result = await jobs.registerCandidates(data.items);
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
    return streamJobEvents<ScanJobEvent>(
      c,
      {
        subscribe: (listener) => {
          const subscription = jobs.subscribe(jobId, listener);
          if (!subscription) throw new Error(`scan job disappeared: ${jobId}`);
          return {
            replay: [{ type: "state", snapshot: subscription.snapshot }],
            live: !isTerminalStatus(subscription.snapshot.status),
            unsubscribe: subscription.unsubscribe,
          };
        },
        isTerminal: isTerminalEvent,
      },
      heartbeatIntervalMs,
    );
  });

  return app;
}
