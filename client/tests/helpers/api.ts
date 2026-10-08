import { vi } from "vitest";
import { rejectUnmockedFetch } from "../unit/setup";

export interface ApiRequest {
  method: string;
  url: URL;
  params: Record<string, string>;
  body: unknown;
  init: RequestInit | undefined;
}

type Reply = Response | unknown;
type Handler = Reply | ((request: ApiRequest) => Reply | Promise<Reply>);

/** キーは `METHOD /api/path`。`:name` はパスセグメント1つに一致し、params に decode 済みで入る */
export type ApiRoutes = Record<string, Handler>;

export function apiResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function apiNoContent(): Response {
  return new Response(null, { status: 204 });
}

export function apiError(status: number, code: string, message = code): Response {
  return apiResponse({ error: { code, message } }, status);
}

interface CompiledRoute {
  key: string;
  method: string;
  segments: string[];
  handler: Handler;
}

function compile(routes: ApiRoutes): CompiledRoute[] {
  return Object.entries(routes).map(([key, handler]) => {
    const [method, path] = key.split(" ");
    if (!method || !path) throw new Error(`ルートキーは "METHOD /path" 形式: ${key}`);
    return { key, method, segments: path.split("/"), handler };
  });
}

function matchSegments(pattern: string[], pathname: string): Record<string, string> | null {
  const actual = pathname.split("/");
  if (actual.length !== pattern.length) return null;
  const params: Record<string, string> = {};
  for (const [i, segment] of pattern.entries()) {
    if (segment.startsWith(":")) params[segment.slice(1)] = decodeURIComponent(actual[i]!);
    else if (segment !== actual[i]) return null;
  }
  return params;
}

function parseBody(init?: RequestInit): unknown {
  return typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
}

export interface ApiMock {
  calls: ApiRequest[];
  /** `METHOD /api/path` と同じキーで呼び出しを絞る */
  requestsTo(key: string): ApiRequest[];
  /** requestsTo と同じ絞り込みで、クエリ文字列つきのパス（/api/works?page=1 など）を返す */
  urlsTo(key: string): string[];
  /** 記録済みの呼び出しを捨てる（以降の呼び出しだけを検証したいとき） */
  clear(): void;
}

/** fetch 境界のモック。一致しない呼び出しはテストを失敗させる。応答の中身は呼び出し側が builders 経由で作る */
export type ApiHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** ルート定義から fetch 互換のハンドラーを作る。一致しない呼び出しはテストを失敗させる */
export function createApiHandler(
  routes: ApiRoutes,
  record?: (key: string, request: ApiRequest) => void,
): ApiHandler {
  const compiled = compile(routes);
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    for (const route of compiled) {
      if (route.method !== method) continue;
      const params = matchSegments(route.segments, url.pathname);
      if (!params) continue;
      const request: ApiRequest = { method, url, params, body: parseBody(init), init };
      record?.(route.key, request);
      const reply =
        typeof route.handler === "function"
          ? await (route.handler as (request: ApiRequest) => Reply)(request)
          : route.handler;
      return reply instanceof Response ? reply : apiResponse(reply);
    }
    return rejectUnmockedFetch(input, init);
  };
}

/** fetch 境界のモック。一致しない呼び出しはテストを失敗させる。応答の中身は呼び出し側が builders 経由で作る */
export function mockApi(routes: ApiRoutes): ApiMock {
  const calls: ApiRequest[] = [];
  const hits: { key: string; request: ApiRequest }[] = [];
  const handler = createApiHandler(routes, (key, request) => {
    calls.push(request);
    hits.push({ key, request });
  });

  vi.stubGlobal("fetch", vi.fn(handler));

  return {
    calls,
    requestsTo: (key) => hits.filter((hit) => hit.key === key).map((hit) => hit.request),
    urlsTo: (key) =>
      hits
        .filter((hit) => hit.key === key)
        .map((hit) => hit.request.url.pathname + hit.request.url.search),
    clear: () => {
      calls.length = 0;
      hits.length = 0;
    },
  };
}
