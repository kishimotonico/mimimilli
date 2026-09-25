// GET/POST /root-reconfiguration（ADR-0029）
import { Hono } from "hono";
import { rootReconfigurationStartRequestSchema } from "@mimimilli/shared";
import { InvalidRootFolderError } from "../errors.ts";
import { conflict, invalidRequest } from "../lib/httpError.ts";
import {
  RootReconfigurationInProgressError,
  type RootReconfigurationWorkflow,
} from "../rootReconfiguration.ts";

export function rootReconfigurationRoute(workflow: RootReconfigurationWorkflow): Hono {
  const app = new Hono();

  app.get("/root-reconfiguration", async (c) => c.json(await workflow.getState()));

  app.post("/root-reconfiguration", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = rootReconfigurationStartRequestSchema.safeParse(body);
    if (!parsed.success) {
      invalidRequest(`ルートフォルダーの指定が不正です: ${parsed.error.issues[0]?.message ?? ""}`);
    }
    try {
      return c.json(await workflow.start(parsed.data.rootFolder), 202);
    } catch (error) {
      if (error instanceof InvalidRootFolderError) invalidRequest(error.message);
      if (error instanceof RootReconfigurationInProgressError) conflict(error.message);
      throw error;
    }
  });

  return app;
}
