// タグ prefix 定義（タグ設定）の CRUD と候補サジェスト（ADR-0005）。
// GET /tag-prefixes | POST /tag-prefixes | PATCH・DELETE /tag-prefixes/:prefix
// PUT /tag-prefixes/order | GET /tag-prefixes/candidates
import { Hono } from "hono";
import {
  tagPrefixCreateSchema,
  tagPrefixNameSchema,
  tagPrefixOrderSchema,
  tagPrefixUpdateSchema,
} from "@mimimilli/shared";
import type { DataAdapter } from "../adapter/index.ts";
import { conflict, invalidRequest, notFound } from "../lib/httpError.ts";
import { readJsonBody } from "../lib/jsonBody.ts";

export function tagPrefixesRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/tag-prefixes", async (c) => {
    return c.json(await adapter.listTagPrefixes());
  });

  app.get("/tag-prefixes/candidates", async (c) => {
    return c.json(await adapter.listTagPrefixCandidates());
  });

  app.post("/tag-prefixes", async (c) => {
    const data = await readJsonBody(
      c,
      tagPrefixCreateSchema,
      (error) => `prefix 定義が不正です: ${error.issues[0]?.message ?? ""}`,
    );
    const created = await adapter.createTagPrefix(data);
    if (!created) conflict(`prefix は既に登録されています: ${data.prefix}`);
    return c.json(created, 201);
  });

  app.put("/tag-prefixes/order", async (c) => {
    const data = await readJsonBody(
      c,
      tagPrefixOrderSchema,
      (error) => `並び順が不正です: ${error.issues[0]?.message ?? ""}`,
    );
    const reordered = await adapter.reorderTagPrefixes(data.prefixes);
    if (!reordered) {
      invalidRequest("並び順の prefix 集合が現在の登録済み prefix と一致しません");
    }
    return c.json(reordered);
  });

  app.patch("/tag-prefixes/:prefix", async (c) => {
    const prefix = normalizePrefixParam(c.req.param("prefix"));
    const data = await readJsonBody(
      c,
      tagPrefixUpdateSchema,
      (error) => `prefix 定義の更新内容が不正です: ${error.issues[0]?.message ?? ""}`,
    );
    const updated = await adapter.updateTagPrefix(prefix, data);
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
