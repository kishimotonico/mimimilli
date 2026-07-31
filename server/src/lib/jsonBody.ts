// POST/PATCH 等で body 省略を許すエンドポイント向けの JSON 読み取り（TASK-136 / TASK-95）。
import type { Context } from "hono";
import { invalidRequest } from "./httpError.ts";

/** body 未送信・空のみ {} とみなす。明示的に送られた不正 JSON / null / 配列は 400。 */
export async function readOptionalJsonBody(
  c: Context,
  invalidMessage = "リクエスト内容が不正です",
): Promise<Record<string, unknown>> {
  const contentLength = c.req.header("content-length");
  if (contentLength === "0") return {};

  const raw = await c.req.text();
  if (raw.length === 0) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      invalidRequest(invalidMessage);
    }
    return parsed as Record<string, unknown>;
  } catch {
    invalidRequest(invalidMessage);
  }
}
