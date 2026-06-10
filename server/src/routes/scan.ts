// POST /scan
import { Hono } from "hono";
import type { DataAdapter } from "../adapter.ts";

export function scanRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.post("/scan", async (c) => {
    const result = await adapter.scan();
    return c.json(result);
  });

  return app;
}
