// 作品関連: GET/PATCH /works, /works/:id/resume, /works/:id/last-played, /works/:id/files,
//          GET /tags, POST /export
import { Hono } from "hono";
import { resumeBodySchema, workPatchSchema, worksQuerySchema } from "@mimikago/shared";
import type { DataAdapter } from "../adapter.ts";
import { invalidRequest, notFound } from "../lib/httpError.ts";

export function worksRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/works", async (c) => {
    const parsed = worksQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      invalidRequest("works のクエリパラメータが不正です");
    }
    const page = await adapter.queryWorks(parsed.data);
    return c.json(page);
  });

  app.get("/works/:id", async (c) => {
    const work = await adapter.getWork(c.req.param("id"));
    if (!work) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.json(work);
  });

  app.patch("/works/:id", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = workPatchSchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("作品の更新内容が不正です");
    }
    const work = await adapter.patchWork(c.req.param("id"), parsed.data);
    if (!work) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.json(work);
  });

  app.post("/works/:id/resume", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = resumeBodySchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("resume の内容が不正です");
    }
    const ok = await adapter.saveResume(c.req.param("id"), parsed.data);
    if (!ok) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.body(null, 204);
  });

  app.post("/works/:id/last-played", async (c) => {
    const ok = await adapter.touchLastPlayed(c.req.param("id"));
    if (!ok) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.body(null, 204);
  });

  app.get("/works/:id/files", async (c) => {
    const tree = await adapter.listWorkFiles(c.req.param("id"));
    if (!tree) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.json(tree);
  });

  app.get("/tags", async (c) => {
    const tags = await adapter.listTags();
    return c.json(tags);
  });

  app.post("/export", async (c) => {
    const data = await adapter.exportLibrary();
    return c.json({ data });
  });

  return app;
}
