// 低レベル HTTP ヘルパー。ドメイン知識を持たず、各 feature / entity の API から利用する。
// 依存方向: shared は最下層。features / entities から import される側で、ここから上位を import しない。

export const API_BASE = "/api";

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`API error ${res.status}: GET ${path}`);
  return res.json();
}

export async function post<T = void>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: POST ${path}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function put(path: string, body: unknown): Promise<void> {
  const res = await fetch(API_BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: PUT ${path}`);
}

export async function del(path: string): Promise<void> {
  const res = await fetch(API_BASE + path, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: DELETE ${path}`);
}
