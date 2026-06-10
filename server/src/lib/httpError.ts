// ルート共通のエラーレスポンスヘルパー。
// shared の apiErrorSchema 形式 `{error: {code, message}}` で常に返す。
import type { ApiError } from "@mimikago/shared";
import { HTTPException } from "hono/http-exception";

const STATUS_BY_CODE = {
  not_found: 404,
  invalid_request: 400,
  conflict: 409,
  internal: 500,
} as const;

/** apiErrorSchema 形式の Response を持つ HTTPException を生成する */
export function apiError(code: ApiError["error"]["code"], message: string): HTTPException {
  const body: ApiError = { error: { code, message } };
  return new HTTPException(STATUS_BY_CODE[code], {
    res: new Response(JSON.stringify(body), {
      status: STATUS_BY_CODE[code],
      headers: { "Content-Type": "application/json" },
    }),
  });
}

/** 404 not_found を投げる */
export function notFound(message: string): never {
  throw apiError("not_found", message);
}

/** 400 invalid_request を投げる */
export function invalidRequest(message: string): never {
  throw apiError("invalid_request", message);
}
