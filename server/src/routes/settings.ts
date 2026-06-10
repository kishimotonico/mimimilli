// GET/PUT /settings
import { Hono } from "hono";
import { settingsUpdateSchema } from "@mimikago/shared";
import type { DataAdapter } from "../adapter.ts";
import { invalidRequest } from "../lib/httpError.ts";

export function settingsRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/settings", async (c) => {
    const settings = await adapter.getSettings();
    return c.json(settings);
  });

  app.put("/settings", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("settings の更新内容が不正です");
    }
    const settings = await adapter.updateSettings(parsed.data);
    return c.json(settings);
  });

  return app;
}
