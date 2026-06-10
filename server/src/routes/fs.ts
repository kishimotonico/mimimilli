// GET /fs?path=...
import { Hono } from "hono";
import type { DataAdapter } from "../adapter.ts";
import { notFound } from "../lib/httpError.ts";

export function fsRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/fs", async (c) => {
    const path = c.req.query("path");
    const listing = await adapter.browseFs(path);
    if (!listing) notFound("指定されたパスは存在しないか、ルート配下ではありません");
    return c.json(listing);
  });

  return app;
}
