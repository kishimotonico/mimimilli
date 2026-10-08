// route のリクエストボディ読み取り。不正 JSON は固定メッセージ、スキーマ不一致は route ごとのメッセージで 400 invalid_request を返す。
import type { Context } from "hono";
import type { ZodError, ZodType } from "zod";
import { invalidRequest } from "./httpError.ts";

const MALFORMED_JSON_MESSAGE = "リクエストの JSON が不正です";

type InvalidMessage = string | ((error: ZodError) => string);

function parseWithSchema<T>(schema: ZodType<T>, value: unknown, invalidMessage: InvalidMessage): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  invalidRequest(
    typeof invalidMessage === "function" ? invalidMessage(parsed.error) : invalidMessage,
  );
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    invalidRequest(MALFORMED_JSON_MESSAGE);
  }
}

/** 必須ボディ。JSON として読み、スキーマで検証した値を返す。 */
export async function readJsonBody<T>(
  c: Context,
  schema: ZodType<T>,
  invalidMessage: InvalidMessage,
): Promise<T> {
  return parseWithSchema(schema, parseJson(await c.req.text()), invalidMessage);
}

/** 任意ボディ。未送信・空は {} として検証する。 */
export async function readOptionalJsonBody<T>(
  c: Context,
  schema: ZodType<T>,
  invalidMessage: InvalidMessage,
): Promise<T> {
  const raw = await c.req.text();
  return parseWithSchema(schema, raw.length === 0 ? {} : parseJson(raw), invalidMessage);
}
