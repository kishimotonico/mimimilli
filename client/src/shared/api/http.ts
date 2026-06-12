// 低レベル HTTP ヘルパー。ドメイン知識を持たず、各 feature / entity の API から利用する。
// 依存方向: shared は最下層。features / entities から import される側で、ここから上位を import しない。
//
// エラーレスポンスは契約v2の apiErrorSchema（{ error: { code, message } }）形式。
// 失敗時はパースしたメッセージを Error に含める。パースできない場合はステータスのみ報告する。

import { apiErrorSchema } from "@mimikago/shared";

export const API_BASE = "/api";

async function throwApiError(method: string, path: string, res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) {
    throw new Error(`API error ${res.status} ${method} ${path}: ${parsed.data.error.message}`);
  }
  throw new Error(`API error ${res.status}: ${method} ${path}`);
}

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path);
  if (!res.ok) return throwApiError("GET", path, res);
  return res.json();
}

export async function post<T = void>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return throwApiError("POST", path, res);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function put<T = void>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return throwApiError("PUT", path, res);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return throwApiError("PATCH", path, res);
  return res.json();
}

export async function del(path: string): Promise<void> {
  const res = await fetch(API_BASE + path, { method: "DELETE" });
  if (!res.ok) return throwApiError("DELETE", path, res);
}
