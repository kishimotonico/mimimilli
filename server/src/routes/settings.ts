// GET /settings
import { Hono } from "hono";
import type { Settings } from "@mimimilli/shared";
import type { DataAdapter } from "../adapter/index.ts";
import type { RootReconfigurationWorkflow } from "../rootReconfiguration.ts";

export function settingsRoute(
  adapter: DataAdapter,
  rootReconfiguration: RootReconfigurationWorkflow,
): Hono {
  const app = new Hono();

  app.get("/settings", async (c) => {
    const settings: Settings = {
      ...(await adapter.getSettings()),
      rootReconfiguration: await rootReconfiguration.getState(),
    };
    return c.json(settings);
  });

  return app;
}
