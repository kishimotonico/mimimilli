// 低レベル HTTP ヘルパー。ドメイン知識を持たず、各 feature / entity の API から利用する。
// 依存方向: shared は最下層。features / entities から import される側で、ここから上位を import しない。
//
// エラーレスポンスは契約v2の apiErrorSchema（{ error: { code, message } }）形式。
// 失敗時はパースしたメッセージを Error に含める。パースできない場合はステータスのみ報告する。

import type { z } from "zod";
import { apiErrorSchema } from "@mimimilli/shared";

export const API_BASE = "/api";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** レスポンスがshared契約のスキーマに適合しない場合に投げる。原因（どのエンドポイントの何が不正か）を隠さず伝える */
export class ApiResponseSchemaError extends Error {
  constructor(
    method: string,
    path: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(
      `APIレスポンスが契約と一致しません: ${method} ${path}\n${issues
        .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("\n")}`,
    );
  }
}

async function throwApiError(method: string, path: string, res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) {
    throw new ApiRequestError(res.status, parsed.data.error.code, parsed.data.error.message);
  }
  throw new Error(`API error ${res.status}: ${method} ${path}`);
}

function parseResponse<T>(schema: z.ZodType<T>, method: string, path: string, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiResponseSchemaError(method, path, parsed.error.issues);
  }
  return parsed.data;
}

/** shared契約のスキーマでレスポンスを検証する GET。検証失敗は握りつぶさず ApiResponseSchemaError を投げる */
export async function getParsed<T>(schema: z.ZodType<T>, path: string): Promise<T> {
  const res = await fetch(API_BASE + path);
  if (!res.ok) return throwApiError("GET", path, res);
  return parseResponse(schema, "GET", path, await res.json());
}

/** shared契約のスキーマでレスポンスを検証する POST */
export async function postParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return throwApiError("POST", path, res);
  return parseResponse(schema, "POST", path, await res.json());
}

/** レスポンスボディを持たない POST。成功時のステータスも204であることを検証する */
export async function postVoid(path: string, body?: unknown): Promise<void> {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return throwApiError("POST", path, res);
  assertNoContent("POST", path, res);
}

/** shared契約のスキーマでレスポンスを検証する PUT */
export async function putParsed<T>(schema: z.ZodType<T>, path: string, body: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return throwApiError("PUT", path, res);
  return parseResponse(schema, "PUT", path, await res.json());
}

/** shared契約のスキーマでレスポンスを検証する PATCH */
export async function patchParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return throwApiError("PATCH", path, res);
  return parseResponse(schema, "PATCH", path, await res.json());
}

/** レスポンスボディを持たない DELETE。成功時のステータスも204であることを検証する */
export async function deleteVoid(path: string): Promise<void> {
  const res = await fetch(API_BASE + path, { method: "DELETE" });
  if (!res.ok) return throwApiError("DELETE", path, res);
  assertNoContent("DELETE", path, res);
}

function assertNoContent(method: string, path: string, res: Response): void {
  if (res.status !== 204) {
    throw new Error(
      `APIレスポンスが契約と一致しません: ${method} ${path}\n- (status): 204を期待しましたが${res.status}でした`,
    );
  }
}
