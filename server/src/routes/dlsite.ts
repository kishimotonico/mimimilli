// POST /dlsite/:id/fetch, POST /dlsite/:id/apply
import { Hono } from "hono";
import { dlsiteApplyBodySchema } from "@mimimilli/shared";
import type { DataAdapter } from "../adapter.ts";
import { apiError, invalidRequest, notFound } from "../lib/httpError.ts";

export function dlsiteRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.post("/dlsite/:id/fetch", async (c) => {
    const result = await adapter.dlsiteFetch(c.req.param("id"));
    if (!result.ok) throw apiError(result.kind, result.message);
    return c.json(result.info);
  });

  app.post("/dlsite/:id/apply", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = dlsiteApplyBodySchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("DLsite適用内容が不正です");
    }
    const ok = await adapter.dlsiteApply(c.req.param("id"), parsed.data);
    if (!ok) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.body(null, 204);
  });

  return app;
}
