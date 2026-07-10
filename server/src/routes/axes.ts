// GET /axes/:axis
// axis は "tag" / "year" / 任意の prefix 文字列（ADR-0005。enum 検証は廃止し、
// 未登録 prefix でも集計自体は可能。軸レールに出すかどうかはクライアント側の関心）
import { Hono } from "hono";
import { facetAxisIdSchema } from "@mimimilli/shared";
import type { DataAdapter } from "../adapter.ts";
import { invalidRequest } from "../lib/httpError.ts";

export function axesRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/axes/:axis", async (c) => {
    const parsed = facetAxisIdSchema.safeParse(c.req.param("axis"));
    if (!parsed.success) {
      invalidRequest(`不正な分類軸です: ${c.req.param("axis")}`);
    }
    const items = await adapter.getAxisFacets(parsed.data);
    return c.json(items);
  });

  return app;
}
