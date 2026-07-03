// GET/POST /smart-folders, PUT/DELETE /smart-folders/:id, GET /smart-folders/:id/works
import { Hono } from "hono";
import { smartFolderCreateSchema, smartFolderUpdateSchema } from "@mimimilli/shared";
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
    const works = await adapter.evalSmartFolder(c.req.param("id"));
    if (!works) notFound(`スマートフォルダーが見つかりません: ${c.req.param("id")}`);
    return c.json(works);
  });

  return app;
}
