import type { IncomingMessage, ServerResponse } from "node:http";

export function matchPath(url: string, pattern: string): Record<string, string> | null {
  const names: string[] = [];
  const regexStr =
    "^" +
    pattern.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, name: string) => {
      names.push(name);
      return "([^/?]+)";
    }) +
    "(?:[/?].*)?$";
  const m = url.match(new RegExp(regexStr));
  if (!m) return null;
  const params: Record<string, string> = {};
  names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
  return params;
}

export function exactPath(url: string, pattern: string): boolean {
  return url === pattern || url.startsWith(pattern + "?");
}

export function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function sendNoContent(res: ServerResponse) {
  res.writeHead(204);
  res.end();
}

export function sendNotFound(res: ServerResponse) {
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
}

export async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data) as Record<string, unknown>);
      } catch {
        resolve({});
      }
    });
  });
}
