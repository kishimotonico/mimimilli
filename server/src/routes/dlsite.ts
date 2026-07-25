// POST /dlsite/:id/fetch, POST /dlsite/:id/apply
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  dlsiteApplyBodySchema,
  dlsiteNotificationQuerySchema,
  dlsiteStatePatchSchema,
} from "@mimimilli/shared";
import type { DataAdapter } from "../adapter.ts";
import { apiError, invalidRequest, notFound } from "../lib/httpError.ts";
import { enqueueDlsiteJob, isDlsiteJobInProgress, subscribeToDlsite } from "./dlsiteProgress.ts";
import { DlsiteOfflineError } from "../adapters/real/dlsiteScheduler.ts";

export function dlsiteRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/dlsite/notifications", async (c) =>
    c.json(await adapter.getDlsiteNotificationSummary()),
  );

  app.get("/dlsite/notifications/:kind", async (c) => {
    const kind = c.req.param("kind");
    if (kind !== "rj-missing" && kind !== "fetch-failed") notFound("通知種別が見つかりません");
    const parsed = dlsiteNotificationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) invalidRequest("DLsite通知のクエリパラメータが不正です");
    return c.json(
      await adapter.queryDlsiteNotifications(kind, {
        page: parsed.data.page ?? 1,
        limit: parsed.data.limit ?? 200,
      }),
    );
  });

  app.post("/dlsite/:id/fetch", async (c) => {
    const forceValue = c.req.query("force");
    if (forceValue !== undefined && forceValue !== "true" && forceValue !== "false") {
      invalidRequest("force は true または false で指定してください");
    }
    const result = await adapter.dlsiteFetch(c.req.param("id"), forceValue === "true");
    if (!result.ok) throw apiError(result.kind, result.message);
    return c.json(result.info);
  });

  app.post("/dlsite/:id/apply", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = dlsiteApplyBodySchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("DLsite適用内容が不正です");
    }
    let ok: boolean;
    try {
      ok = await adapter.dlsiteApply(c.req.param("id"), parsed.data);
    } catch (error) {
      if (error instanceof DlsiteOfflineError) throw apiError("offline", error.message);
      throw error;
    }
    if (!ok) notFound(`作品が見つかりません: ${c.req.param("id")}`);
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

  app.post("/dlsite/bulk", async (c) => {
    if (isDlsiteJobInProgress()) throw apiError("conflict", "DLsite取得は既に実行中です");
    enqueueDlsiteJob(adapter, "existing", undefined);
    return c.json({ started: true }, 202);
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
        if (event.type !== "progress") void written.then(resolveDone);
      };
      const subscription = subscribeToDlsite(listener);
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
