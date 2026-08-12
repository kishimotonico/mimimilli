// GET /fs?path=...
import { Hono } from "hono";
import { workspacePathSchema } from "@mimimilli/shared";
import type { DataAdapter } from "../adapter/index.ts";
import { notFound } from "../lib/httpError.ts";

export function fsRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/fs", async (c) => {
    const rawPath = c.req.query("path");
    const parsed = rawPath === undefined ? undefined : workspacePathSchema.safeParse(rawPath);
    if (parsed && !parsed.success)
      notFound("指定されたパスは存在しないか、ルート配下ではありません");
    const listing = await adapter.browseFs(parsed?.data);
    if (!listing) notFound("指定されたパスは存在しないか、ルート配下ではありません");
    return c.json(listing);
  });

  return app;
}
