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

/** fetch が応答を得られなかった切断・中断。正本はサーバに届いていないか不明。 */
export class ApiTransportError extends Error {
  constructor(
    readonly kind: "unreachable" | "aborted",
    readonly cause?: unknown,
  ) {
    super(kind === "aborted" ? "リクエストが中断されました" : "サーバに接続できませんでした");
  }
}

async function fetchApi(input: string, init?: RequestInit): Promise<Response> {
  try {
    return init === undefined ? await fetch(input) : await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiTransportError("aborted", error);
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiTransportError("aborted", error);
    }
    throw new ApiTransportError("unreachable", error);
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

class UnparsedResponseBody {
  constructor(readonly text: string) {}
}

function unparsedBodyMessage(body: unknown): string | null {
  if (body instanceof UnparsedResponseBody) {
    const preview = body.text.length > 200 ? `${body.text.slice(0, 200)}…` : body.text;
    return `応答のJSON解析に失敗しました: ${preview}`;
  }
  return null;
}

async function readResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return new UnparsedResponseBody(text);
  }
}

export interface ApiErrorNotification {
  status: number;
  code: string;
}

type ApiErrorListener = (notification: ApiErrorNotification) => void;
const apiErrorListeners = new Set<ApiErrorListener>();

/** ドメイン非依存のAPIエラー購読口。契約形式（{error:{code,message}}）のエラー応答を
 *  受けるたびstatus・codeだけを通知する。TanStack Queryのonerrorを経由しない直接
 *  呼び出し（await getParsed(...)等）でも同じ経路で拾えるよう、throwApiErrorの
 *  内側から呼ぶ。呼び出し側（app層等）がcode別の意味づけを持つ。 */
export function onApiError(listener: ApiErrorListener): () => void {
  apiErrorListeners.add(listener);
  return () => apiErrorListeners.delete(listener);
}

export type StatusHandler = (res: Response, body: unknown) => void;

async function throwApiError(
  method: string,
  path: string,
  res: Response,
  body: unknown,
  onStatus?: Partial<Record<number, StatusHandler>>,
): Promise<never> {
  onStatus?.[res.status]?.(res, body);
  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) {
    const notification = { status: res.status, code: parsed.data.error.code };
    for (const listener of apiErrorListeners) listener(notification);
    throw new ApiRequestError(res.status, parsed.data.error.code, parsed.data.error.message);
  }
  const unparsed = unparsedBodyMessage(body);
  throw new Error(
    unparsed
      ? `API error ${res.status}: ${method} ${path} (${unparsed})`
      : `API error ${res.status}: ${method} ${path}`,
  );
}

function parseResponse<T>(schema: z.ZodType<T>, method: string, path: string, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiResponseSchemaError(method, path, parsed.error.issues);
  }
  return parsed.data;
}

export interface ParsedRequestOptions {
  /** React Query の queryFn signal などを渡すと中断を伝播できる */
  signal?: AbortSignal;
  /** 204 のときボディを読まず null を返す */
  noContentAsNull?: boolean;
  /** 非 ok 応答時、既定の ApiRequestError の前に呼ぶ。throw すればそこで終了する */
  onStatus?: Partial<Record<number, StatusHandler>>;
}

async function handleParsedResponse<T>(
  method: string,
  path: string,
  res: Response,
  schema: z.ZodType<T>,
  options?: ParsedRequestOptions,
): Promise<T | null> {
  if (res.status === 204) {
    if (options?.noContentAsNull) return null;
    throw new Error(
      `APIレスポンスが契約と一致しません: ${method} ${path}\n- (status): JSONボディを期待しましたが204でした`,
    );
  }
  if (!res.ok) {
    const body = await readResponseBody(res);
    return throwApiError(method, path, res, body, options?.onStatus);
  }
  return parseResponse(schema, method, path, await res.json());
}

/** shared契約のスキーマでレスポンスを検証する GET。検証失敗は握りつぶさず ApiResponseSchemaError を投げる */
export async function getParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  options?: ParsedRequestOptions & { noContentAsNull?: false | undefined },
): Promise<T>;
export async function getParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  options: ParsedRequestOptions & { noContentAsNull: true },
): Promise<T | null>;
export async function getParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  options?: ParsedRequestOptions,
): Promise<T | null> {
  const res = options?.signal
    ? await fetchApi(API_BASE + path, { signal: options.signal })
    : await fetchApi(API_BASE + path);
  return handleParsedResponse("GET", path, res, schema, options);
}

/** shared契約のスキーマでレスポンスを検証する POST */
export async function postParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  body?: unknown,
  options?: ParsedRequestOptions & { noContentAsNull?: false | undefined },
): Promise<T>;
export async function postParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  body: unknown,
  options: ParsedRequestOptions & { noContentAsNull: true },
): Promise<T | null>;
export async function postParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  body?: unknown,
  options?: ParsedRequestOptions,
): Promise<T | null> {
  const res = await fetchApi(API_BASE + path, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: options?.signal,
  });
  return handleParsedResponse("POST", path, res, schema, options);
}

/** レスポンスボディを持たない POST。成功時のステータスも204であることを検証する */
export async function postVoid(path: string, body?: unknown): Promise<void> {
  const res = await fetchApi(API_BASE + path, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return throwApiError("POST", path, res, await readResponseBody(res));
  assertNoContent("POST", path, res);
}

/** shared契約のスキーマでレスポンスを検証する PUT */
export async function putParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  body?: unknown,
  options?: ParsedRequestOptions & { noContentAsNull?: false | undefined },
): Promise<T>;
export async function putParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  body: unknown,
  options: ParsedRequestOptions & { noContentAsNull: true },
): Promise<T | null>;
export async function putParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  body?: unknown,
  options?: ParsedRequestOptions,
): Promise<T | null> {
  const res = await fetchApi(API_BASE + path, {
    method: "PUT",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    signal: options?.signal,
  });
  return handleParsedResponse("PUT", path, res, schema, options);
}

/** shared契約のスキーマでレスポンスを検証する PATCH */
export async function patchParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  body: unknown,
  options?: ParsedRequestOptions & { noContentAsNull?: false | undefined },
): Promise<T>;
export async function patchParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  body: unknown,
  options: ParsedRequestOptions & { noContentAsNull: true },
): Promise<T | null>;
export async function patchParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  body: unknown,
  options?: ParsedRequestOptions,
): Promise<T | null> {
  const res = await fetchApi(API_BASE + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options?.signal,
  });
  return handleParsedResponse("PATCH", path, res, schema, options);
}

/** shared契約のスキーマでレスポンスを検証する DELETE */
export async function deleteParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  options?: ParsedRequestOptions & { noContentAsNull?: false | undefined },
): Promise<T>;
export async function deleteParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  options: ParsedRequestOptions & { noContentAsNull: true },
): Promise<T | null>;
export async function deleteParsed<T>(
  schema: z.ZodType<T>,
  path: string,
  options?: ParsedRequestOptions,
): Promise<T | null> {
  const res = await fetchApi(API_BASE + path, {
    method: "DELETE",
    signal: options?.signal,
  });
  return handleParsedResponse("DELETE", path, res, schema, options);
}

/** レスポンスボディを持たない DELETE。成功時のステータスも204であることを検証する */
export async function deleteVoid(path: string): Promise<void> {
  const res = await fetchApi(API_BASE + path, { method: "DELETE" });
  if (!res.ok) return throwApiError("DELETE", path, res, await readResponseBody(res));
  assertNoContent("DELETE", path, res);
}

function assertNoContent(method: string, path: string, res: Response): void {
  if (res.status !== 204) {
    throw new Error(
      `APIレスポンスが契約と一致しません: ${method} ${path}\n- (status): 204を期待しましたが${res.status}でした`,
    );
  }
}
