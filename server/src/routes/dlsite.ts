// POST /dlsite/:id/fetch, POST /dlsite/:id/apply
import { Hono } from "hono";
import {
  dlsiteApplyBodySchema,
  dlsiteApplyMissingBodySchema,
  dlsiteApplyMissingPreviewSchema,
  dlsiteBulkApplyMissingResultSchema,
  dlsiteJobCancelBulkResponseSchema,
  dlsiteJobCurrentResponseSchema,
  dlsiteJobStartBodySchema,
  dlsiteJobStartResponseSchema,
  type DlsiteJobEvent,
  dlsiteFetchByCodeBodySchema,
  dlsiteFetchByCodeResponseSchema,
  dlsiteNotificationKindSchema,
  dlsiteNotificationQuerySchema,
  dlsiteStateUpdateBodySchema,
  workSourceMutationResultSchema,
} from "@mimimilli/shared";
import { DlsiteOfflineError } from "../errors.ts";
import type { DataAdapter } from "../adapter/index.ts";
import { apiError, invalidRequest, notFound, throwSourceCommandError } from "../lib/httpError.ts";
import { readJsonBody, readOptionalJsonBody } from "../lib/jsonBody.ts";
import { getCategoryLogger } from "../lib/logger.ts";
import type { DlsiteJobManager } from "../dlsiteJobManager.ts";
import { SSE_HEARTBEAT_INTERVAL_MS, streamJobEvents } from "../lib/sseStream.ts";

const dlsiteLogger = getCategoryLogger("dlsite");

function isClientAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function dlsiteRoute(
  adapter: DataAdapter,
  dlsiteJobs: DlsiteJobManager,
  heartbeatIntervalMs: number = SSE_HEARTBEAT_INTERVAL_MS,
): Hono {
  const app = new Hono();

  app.get("/dlsite/notifications", async (c) =>
    c.json(await adapter.getDlsiteNotificationSummary()),
  );

  app.get("/dlsite/notifications/:kind", async (c) => {
    const parsedKind = dlsiteNotificationKindSchema.safeParse(c.req.param("kind"));
    if (!parsedKind.success) notFound("通知種別が見つかりません");
    const parsed = dlsiteNotificationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) invalidRequest("DLsite通知のクエリパラメータが不正です");
    return c.json(
      await adapter.queryDlsiteNotifications(parsedKind.data, {
        page: parsed.data.page ?? 1,
        limit: parsed.data.limit ?? 200,
      }),
    );
  });

  app.post("/dlsite/fetch-by-code", async (c) => {
    const data = await readJsonBody(
      c,
      dlsiteFetchByCodeBodySchema,
      (error) => error.issues[0]?.message ?? "RJ/VJコードが不正です",
    );
    const forceValue = c.req.query("force");
    if (forceValue !== undefined && forceValue !== "true" && forceValue !== "false") {
      invalidRequest("force は true または false で指定してください");
    }
    try {
      const result = await adapter.dlsiteFetchByCode(data.rjCode, forceValue === "true", {
        signal: c.req.raw.signal,
      });
      if (!result.ok) throw apiError(result.kind, result.message);
      return c.json(
        dlsiteFetchByCodeResponseSchema.parse({
          info: result.info,
          cachedCover: adapter.lookupDlsiteCachedCover(result.info.coverUrl),
        }),
      );
    } catch (error) {
      if (isClientAbort(error)) {
        dlsiteLogger.info("クライアント切断によりDLsite取得を中断しました", {
          rjCode: data.rjCode,
        });
        return;
      }
      throw error;
    }
  });

  app.post("/dlsite/:id/fetch", async (c) => {
    const forceValue = c.req.query("force");
    if (forceValue !== undefined && forceValue !== "true" && forceValue !== "false") {
      invalidRequest("force は true または false で指定してください");
    }
    const workId = c.req.param("id");
    try {
      const result = await adapter.dlsiteFetch(workId, forceValue === "true", {
        signal: c.req.raw.signal,
      });
      if (!result.ok) throw apiError(result.kind, result.message);
      try {
        const snapshot = await adapter.getWorkEditSnapshot(workId);
        if (!snapshot) notFound(`作品が見つかりません: ${workId}`);
        return c.json({ info: result.info, sourceRevision: snapshot.sourceRevision });
      } catch (error) {
        throwSourceCommandError(error);
      }
    } catch (error) {
      if (isClientAbort(error)) {
        dlsiteLogger.info("クライアント切断によりDLsite取得を中断しました", { workId });
        return;
      }
      throw error;
    }
  });

  app.post("/dlsite/:id/apply", async (c) => {
    const data = await readJsonBody(c, dlsiteApplyBodySchema, "DLsite適用内容が不正です");
    const workId = c.req.param("id");
    let result;
    try {
      result = await adapter.dlsiteApply(workId, data, { signal: c.req.raw.signal });
    } catch (error) {
      if (isClientAbort(error)) {
        dlsiteLogger.info("クライアント切断によりDLsite適用を中断しました", { workId });
        return;
      }
      if (error instanceof DlsiteOfflineError) throw apiError("offline", error.message);
      throwSourceCommandError(error);
    }
    if (!result) notFound(`作品が見つかりません: ${workId}`);
    return c.json(workSourceMutationResultSchema.parse(result));
  });

  app.post("/dlsite/apply-missing", async (c) => {
    const data = await readOptionalJsonBody(
      c,
      dlsiteApplyMissingBodySchema,
      "workIds は文字列配列で指定してください",
    );
    return c.json(
      dlsiteBulkApplyMissingResultSchema.parse(await adapter.dlsiteApplyMissing(data.workIds)),
    );
  });

  app.post("/dlsite/apply-missing/preview", async (c) => {
    const data = await readOptionalJsonBody(
      c,
      dlsiteApplyMissingBodySchema,
      "workIds は文字列配列で指定してください",
    );
    return c.json(
      dlsiteApplyMissingPreviewSchema.parse(await adapter.dlsiteApplyMissingPreview(data.workIds)),
    );
  });

  app.patch("/dlsite/:id", async (c) => {
    const data = await readJsonBody(
      c,
      dlsiteStateUpdateBodySchema,
      (error) => error.issues[0]?.message ?? "DLsite状態が不正です",
    );
    try {
      const result = await adapter.updateDlsiteState(c.req.param("id"), data);
      if (!result) notFound(`作品が見つかりません: ${c.req.param("id")}`);
      return c.json(workSourceMutationResultSchema.parse(result));
    } catch (error) {
      throwSourceCommandError(error);
    }
  });

  app.post("/dlsite/jobs", async (c) => {
    const data = await readJsonBody(
      c,
      dlsiteJobStartBodySchema,
      (error) => error.issues[0]?.message ?? "DLsite取得ジョブの指定が不正です",
    );
    if (adapter.isDlsiteOffline()) {
      throw apiError("offline", "オフライン設定のためDLsiteから取得できません");
    }
    const jobId = dlsiteJobs.start(data);
    if (!jobId) throw apiError("conflict", "サーバーの終了処理中のためDLsite取得を開始できません");
    return c.json(dlsiteJobStartResponseSchema.parse({ jobId }), 202);
  });

  app.get("/dlsite/jobs/current", (c) =>
    c.json(dlsiteJobCurrentResponseSchema.parse({ job: dlsiteJobs.getSnapshot() })),
  );

  app.delete("/dlsite/jobs/:jobId/bulk", (c) =>
    c.json(
      dlsiteJobCancelBulkResponseSchema.parse({
        removed: dlsiteJobs.cancelBulk(c.req.param("jobId")),
      }),
    ),
  );

  app.get("/dlsite/jobs/events", (c) =>
    streamJobEvents<DlsiteJobEvent>(
      c,
      {
        subscribe: (listener) => dlsiteJobs.subscribe(listener),
        isTerminal: (event) => event.type === "finished",
      },
      heartbeatIntervalMs,
    ),
  );

  return app;
}
