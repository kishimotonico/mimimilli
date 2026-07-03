// GET/POST /presets, DELETE /presets/:id
import { Hono } from "hono";
import { searchPresetCreateSchema } from "@mimimilli/shared";
import type { DataAdapter } from "../adapter.ts";
import { invalidRequest, notFound } from "../lib/httpError.ts";

export function presetsRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/presets", async (c) => {
    const presets = await adapter.listPresets();
    return c.json(presets);
  });

  app.post("/presets", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = searchPresetCreateSchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest("検索プリセットの作成内容が不正です");
    }
    const preset = await adapter.createPreset(parsed.data);
    return c.json(preset, 201);
  });

  app.delete("/presets/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) {
      invalidRequest(`不正なプリセットIDです: ${c.req.param("id")}`);
    }
    const ok = await adapter.deletePreset(id);
    if (!ok) notFound(`検索プリセットが見つかりません: ${c.req.param("id")}`);
    return c.body(null, 204);
  });

  return app;
}
