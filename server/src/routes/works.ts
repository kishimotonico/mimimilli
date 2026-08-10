// 作品関連: GET/PATCH/DELETE /works, /works/:id/resume, /works/:id/last-played, /works/:id/files,
//          GET /tags, POST /export, POST /works, GET /works/register-preview
import { Hono } from "hono";
import {
  resumeBodySchema,
  WORKS_DEFAULT_PAGE_SIZE,
  workCreateBodySchema,
  workPatchSchema,
  workRegisterPreviewQuerySchema,
  worksQuerySchema,
} from "@mimimilli/shared";
import { InvalidResumeError, WorkRegisterError } from "../errors.ts";
import type { DataAdapter } from "../adapter/index.ts";
import { conflict, invalidRequest, notFound } from "../lib/httpError.ts";

export function worksRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/works", async (c) => {
    const parsed = worksQuerySchema.safeParse({
      ...c.req.query(),
      tags: c.req.queries("tags"),
      ids: c.req.queries("ids"),
    });
    if (!parsed.success) {
      invalidRequest("works のクエリパラメータが不正です");
    }
    // page/limit 未指定でもサーバー側デフォルトでページングする（TASK-73）。
    // limit だけの指定は page=1 として扱う
    const page = await adapter.queryWorks({
      ...parsed.data,
      page: parsed.data.page ?? 1,
      limit: parsed.data.limit ?? WORKS_DEFAULT_PAGE_SIZE,
    });
    return c.json(page);
  });

  app.get("/works/register-preview", async (c) => {
    const parsed = workRegisterPreviewQuerySchema.safeParse(c.req.query());
    if (!parsed.success) invalidRequest("register-preview のクエリパラメータが不正です");
    const preview = await adapter.getWorkRegisterPreview(parsed.data.path);
    if (!preview) notFound("指定されたパスは存在しないか、ルート配下ではありません");
    return c.json(preview);
  });

  app.post("/works", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = workCreateBodySchema.safeParse(body);
    if (!parsed.success) invalidRequest("作品の登録内容が不正です");
    try {
      const work = await adapter.createWork(parsed.data);
      if (!work) notFound("指定されたパスは存在しないか、ルート配下ではありません");
      return c.json(work, 201);
    } catch (error) {
      if (error instanceof WorkRegisterError) {
        if (error.code === "already_registered") conflict(error.message);
        if (error.code === "descendants_require_merge") conflict(error.message);
        if (error.code === "invalid_meta") conflict(error.message);
        if (error.code === "not_configured") notFound(error.message);
      }
      throw error;
    }
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

  app.delete("/works/:id", async (c) => {
    const ok = await adapter.deleteWork(c.req.param("id"));
    if (!ok) notFound(`作品が見つかりません: ${c.req.param("id")}`);
    return c.body(null, 204);
  });

  app.post("/works/:id/resume", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = resumeBodySchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("resume の内容が不正です");
    }
    const ok = await adapter.saveResume(c.req.param("id"), parsed.data).catch((error) => {
      if (error instanceof InvalidResumeError) invalidRequest(error.message);
      throw error;
    });
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
    const exported = await adapter.exportLibrary();
    return c.json(exported);
  });

  return app;
}
