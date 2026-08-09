// POST /dlsite/:id/fetch, POST /dlsite/:id/apply
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  dlsiteApplyBodySchema,
  dlsiteBulkCancelResponseSchema,
  dlsiteFetchByCodeBodySchema,
  dlsiteNotificationKindSchema,
  dlsiteNotificationQuerySchema,
  dlsiteStatePatchSchema,
} from "@mimimilli/shared";
import { DlsiteOfflineError } from "../errors.ts";
import type { DataAdapter } from "../adapter/index.ts";
import { apiError, invalidRequest, notFound } from "../lib/httpError.ts";
import { getCategoryLogger } from "../lib/logger.ts";
import type { DlsiteJobManager } from "../dlsiteJobManager.ts";

const dlsiteLogger = getCategoryLogger("dlsite");

function isClientAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function dlsiteRoute(adapter: DataAdapter, dlsiteJobs: DlsiteJobManager): Hono {
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
    const body = await c.req.json().catch(() => null);
    const parsed = dlsiteFetchByCodeBodySchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest(parsed.error.issues[0]?.message ?? "RJ/VJコードが不正です");
    }
    const forceValue = c.req.query("force");
    if (forceValue !== undefined && forceValue !== "true" && forceValue !== "false") {
      invalidRequest("force は true または false で指定してください");
    }
    try {
      const result = await adapter.dlsiteFetchByCode(parsed.data.rjCode, forceValue === "true", {
        signal: c.req.raw.signal,
      });
      if (!result.ok) throw apiError(result.kind, result.message);
      return c.json(result.info);
    } catch (error) {
      if (isClientAbort(error)) {
        dlsiteLogger.info("クライアント切断によりDLsite取得を中断しました", {
          rjCode: parsed.data.rjCode,
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
      return c.json(result.info);
    } catch (error) {
      if (isClientAbort(error)) {
        dlsiteLogger.info("クライアント切断によりDLsite取得を中断しました", { workId });
        return;
      }
      throw error;
    }
  });

  app.post("/dlsite/:id/apply", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = dlsiteApplyBodySchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("DLsite適用内容が不正です");
    }
    const workId = c.req.param("id");
    let ok: boolean;
    try {
      ok = await adapter.dlsiteApply(workId, parsed.data, { signal: c.req.raw.signal });
    } catch (error) {
      if (isClientAbort(error)) {
        dlsiteLogger.info("クライアント切断によりDLsite適用を中断しました", { workId });
        return;
      }
      if (error instanceof DlsiteOfflineError) throw apiError("offline", error.message);
      throw error;
    }
    if (!ok) notFound(`作品が見つかりません: ${workId}`);
    return c.body(null, 204);
  });

  app.patch("/dlsite/:id", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = dlsiteStatePatchSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error.issues[0]?.message ?? "DLsite状態が不正です");
    const work = await adapter.updateDlsiteState(c.req.param("id"), parsed.data);
    if (!work) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.json(work);
  });

  app.get("/dlsite/bulk", (c) => {
    const snapshot = dlsiteJobs.getSnapshot();
    return snapshot ? c.json(snapshot) : c.body(null, 204);
  });

  app.post("/dlsite/bulk", async (c) => {
    if (dlsiteJobs.isInProgress()) throw apiError("conflict", "DLsite取得は既に実行中です");
    dlsiteJobs.enqueue("existing", undefined);
    return c.json({ started: true }, 202);
  });

  app.delete("/dlsite/bulk", (c) => {
    if (!dlsiteJobs.cancel()) notFound("実行中のDLsite一括取得がありません");
    return c.json(dlsiteBulkCancelResponseSchema.parse({ cancelling: true }));
  });

  app.get("/dlsite/events", (c) =>
    streamSSE(c, async (stream) => {
      let resolveDone!: () => void;
      const done = new Promise<void>((resolve) => (resolveDone = resolve));
      let chain = Promise.resolve();
      const send = (event: import("@mimimilli/shared").DlsiteBulkProgressEvent) => {
        chain = chain.then(() =>
          stream.writeSSE({ event: event.type, data: JSON.stringify(event) }),
        );
        return chain;
      };
      const listener = (event: import("@mimimilli/shared").DlsiteBulkProgressEvent) => {
        const written = send(event);
        if (event.type !== "progress" && event.type !== "cancelling")
          void written.then(resolveDone);
      };
      const subscription = dlsiteJobs.subscribe(listener);
      for (const event of subscription.replay) await send(event);
      if (!subscription.isLive || subscription.replay.some((event) => event.type !== "progress")) {
        subscription.unsubscribe();
        return;
      }
      stream.onAbort(resolveDone);
      await done;
      await chain;
      subscription.unsubscribe();
    }),
  );

  return app;
}
