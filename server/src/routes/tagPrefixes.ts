// タグ prefix 定義（タグ設定）の CRUD と候補サジェスト（ADR-0005）。
// GET /tag-prefixes | POST /tag-prefixes | PATCH・DELETE /tag-prefixes/:prefix
// GET /tag-prefixes/candidates
import { Hono } from "hono";
import {
  tagPrefixCreateSchema,
  tagPrefixNameSchema,
  tagPrefixUpdateSchema,
} from "@mimimilli/shared";
import type { DataAdapter } from "../adapter.ts";
import { conflict, invalidRequest, notFound } from "../lib/httpError.ts";

export function tagPrefixesRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/tag-prefixes", async (c) => {
    return c.json(await adapter.listTagPrefixes());
  });

  app.get("/tag-prefixes/candidates", async (c) => {
    return c.json(await adapter.listTagPrefixCandidates());
  });

  app.post("/tag-prefixes", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = tagPrefixCreateSchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest(`prefix 定義が不正です: ${parsed.error.issues[0]?.message ?? ""}`);
    }
    const created = await adapter.createTagPrefix(parsed.data);
    if (!created) conflict(`prefix は既に登録されています: ${parsed.data.prefix}`);
    return c.json(created, 201);
  });

  app.patch("/tag-prefixes/:prefix", async (c) => {
    const prefix = normalizePrefixParam(c.req.param("prefix"));
    const body = await c.req.json().catch(() => null);
    const parsed = tagPrefixUpdateSchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest(`prefix 定義の更新内容が不正です: ${parsed.error.issues[0]?.message ?? ""}`);
    }
    const updated = await adapter.updateTagPrefix(prefix, parsed.data);
    if (!updated) notFound(`prefix 定義が見つかりません: ${prefix}`);
    return c.json(updated);
  });

  app.delete("/tag-prefixes/:prefix", async (c) => {
    const prefix = normalizePrefixParam(c.req.param("prefix"));
    const deleted = await adapter.deleteTagPrefix(prefix);
    if (!deleted) notFound(`prefix 定義が見つかりません: ${prefix}`);
    return c.body(null, 204);
  });

  return app;
}

/** パスパラメータの prefix を正規形（小文字）へ。DB は正規形で保持している */
function normalizePrefixParam(raw: string): string {
  const parsed = tagPrefixNameSchema.safeParse(raw);
  if (!parsed.success) {
    invalidRequest(`不正な prefix です: ${raw}`);
  }
  return parsed.data;
}
