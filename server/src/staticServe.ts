import { existsSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "./app.ts";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const NO_CACHE = "no-cache";

export function resolveStaticDir(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === "") return undefined;

  const dir = resolve(raw);
  let stat;
  try {
    stat = statSync(dir);
  } catch {
    throw new Error(`MIMIMILLI_STATIC_DIR で指定されたディレクトリが存在しません: ${dir}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`MIMIMILLI_STATIC_DIR はディレクトリである必要があります: ${dir}`);
  }

  const indexPath = join(dir, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(`MIMIMILLI_STATIC_DIR に index.html がありません: ${indexPath}`);
  }

  return dir;
}

function cacheControlForPath(urlPath: string): string {
  if (urlPath.startsWith("/assets/")) {
    return IMMUTABLE_CACHE;
  }
  return NO_CACHE;
}

function isResolvedPathInsideRoot(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}/`)) {
    return false;
  }
  try {
    const realRoot = realpathSync(resolvedRoot);
    const realCandidate = realpathSync(resolvedCandidate);
    return realCandidate === realRoot || realCandidate.startsWith(`${realRoot}/`);
  } catch {
    return false;
  }
}

function serveFile(c: Context, file: Bun.BunFile, cacheControl: string): Response {
  const headers = new Headers();
  headers.set("Cache-Control", cacheControl);
  if (c.req.method === "HEAD") {
    headers.set("Content-Type", file.type);
    headers.set("Content-Length", String(file.size));
    return new Response(null, { status: 200, headers });
  }
  return new Response(file, { headers });
}

function isApiPath(urlPath: string): boolean {
  return urlPath === "/api" || urlPath.startsWith("/api/");
}

export function createStaticMiddleware(staticDir: string): MiddlewareHandler<AppEnv> {
  const root = resolve(staticDir);
  const indexFile = Bun.file(join(root, "index.html"));

  return async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      return next();
    }

    const urlPath = c.req.path;
    if (isApiPath(urlPath)) {
      return next();
    }

    const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
    const candidate = resolve(root, relative);
    if (isResolvedPathInsideRoot(root, candidate)) {
      const candidateFile = Bun.file(candidate);
      if (await candidateFile.exists()) {
        const stat = await candidateFile.stat();
        if (stat.isFile()) {
          return serveFile(c, candidateFile, cacheControlForPath(urlPath));
        }
      }
    }

    return serveFile(c, indexFile, NO_CACHE);
  };
}
