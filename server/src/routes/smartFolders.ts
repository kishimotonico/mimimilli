// GET/POST /smart-folders, PUT/DELETE /smart-folders/:id, GET /smart-folders/:id/works
import { Hono } from "hono";
import {
  smartFolderCreateSchema,
  smartFolderUpdateSchema,
  smartFolderWorksQuerySchema,
  WORKS_DEFAULT_PAGE_SIZE,
} from "@mimimilli/shared";
import type { DataAdapter } from "../adapter.ts";
import { invalidRequest, notFound } from "../lib/httpError.ts";

export function smartFoldersRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/smart-folders", async (c) => {
    const folders = await adapter.listSmartFolders();
    return c.json(folders);
  });

  app.post("/smart-folders", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = smartFolderCreateSchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("スマートフォルダーの作成内容が不正です");
    }
    const folder = await adapter.createSmartFolder(parsed.data);
    return c.json(folder, 201);
  });

  app.put("/smart-folders/:id", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = smartFolderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("スマートフォルダーの更新内容が不正です");
    }
    const folder = await adapter.updateSmartFolder(c.req.param("id"), parsed.data);
    if (!folder) notFound(`スマートフォルダーが見つかりません: ${c.req.param("id")}`);
    return c.json(folder);
  });

  app.delete("/smart-folders/:id", async (c) => {
    const ok = await adapter.deleteSmartFolder(c.req.param("id"));
    if (!ok) notFound(`スマートフォルダーが見つかりません: ${c.req.param("id")}`);
    return c.body(null, 204);
  });

  app.get("/smart-folders/:id/works", async (c) => {
    const parsed = smartFolderWorksQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      invalidRequest("スマートフォルダーのクエリパラメータが不正です");
    }
    const page = await adapter.evalSmartFolder(c.req.param("id"), {
      page: parsed.data.page ?? 1,
      limit: parsed.data.limit ?? WORKS_DEFAULT_PAGE_SIZE,
      seed: parsed.data.seed,
    });
    if (!page) notFound(`スマートフォルダーが見つかりません: ${c.req.param("id")}`);
    return c.json(page);
  });

  return app;
}
