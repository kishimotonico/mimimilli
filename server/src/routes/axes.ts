// GET /axes/:axis
import { Hono } from "hono";
import { facetAxisSchema } from "@mimimilli/shared";
import type { DataAdapter } from "../adapter.ts";
import { invalidRequest } from "../lib/httpError.ts";

export function axesRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/axes/:axis", async (c) => {
    const parsed = facetAxisSchema.safeParse(c.req.param("axis"));
    if (!parsed.success) {
      invalidRequest(`不正な分類軸です: ${c.req.param("axis")}`);
    }
    const items = await adapter.getAxisFacets(parsed.data);
    return c.json(items);
  });

  return app;
}
