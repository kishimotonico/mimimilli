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

function acceptsEncoding(acceptEncoding: string | undefined, encoding: string): boolean {
  if (!acceptEncoding) return false;

  const normalized = encoding.toLowerCase();
  for (const part of acceptEncoding.split(",")) {
    const [name, ...params] = part.trim().split(";");
    if (!name) continue;
    const candidate = name.trim().toLowerCase();
    if (candidate !== normalized && candidate !== "*") continue;

    let q = 1;
    for (const param of params) {
      const match = param.trim().match(/^q=(\d+(?:\.\d+)?)$/);
      if (match) q = Number(match[1]);
    }
    return q > 0;
  }

  return false;
}

async function selectEncodedFile(
  filePath: string,
  acceptEncoding: string | undefined,
): Promise<{ file: Bun.BunFile; encoding?: string; contentType: string } | null> {
  const rawFile = Bun.file(filePath);
  if (!(await rawFile.exists())) return null;
  const rawStat = await rawFile.stat();
  if (!rawStat.isFile()) return null;

  const contentType = rawFile.type;
  if (acceptsEncoding(acceptEncoding, "br")) {
    const brFile = Bun.file(`${filePath}.br`);
    if (await brFile.exists()) {
      return { file: brFile, encoding: "br", contentType };
    }
  }
  if (acceptsEncoding(acceptEncoding, "gzip")) {
    const gzFile = Bun.file(`${filePath}.gz`);
    if (await gzFile.exists()) {
      return { file: gzFile, encoding: "gzip", contentType };
    }
  }

  return { file: rawFile, contentType };
}

function serveFile(
  c: Context,
  file: Bun.BunFile,
  cacheControl: string,
  options: { encoding?: string; contentType: string },
): Response {
  const headers = new Headers();
  headers.set("Cache-Control", cacheControl);
  headers.set("Vary", "Accept-Encoding");
  headers.set("Content-Type", options.contentType);
  if (options.encoding) {
    headers.set("Content-Encoding", options.encoding);
  }
  if (c.req.method === "HEAD") {
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
  const indexPath = join(root, "index.html");

  return async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      return next();
    }

    const urlPath = c.req.path;
    if (isApiPath(urlPath)) {
      return next();
    }

    const acceptEncoding = c.req.header("Accept-Encoding");
    const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
    const candidate = resolve(root, relative);
    if (isResolvedPathInsideRoot(root, candidate)) {
      const selected = await selectEncodedFile(candidate, acceptEncoding);
      if (selected) {
        const stat = await selected.file.stat();
        if (stat.isFile()) {
          return serveFile(c, selected.file, cacheControlForPath(urlPath), {
            encoding: selected.encoding,
            contentType: selected.contentType,
          });
        }
      }
    }

    const indexSelected = await selectEncodedFile(indexPath, acceptEncoding);
    if (indexSelected) {
      return serveFile(c, indexSelected.file, NO_CACHE, {
        encoding: indexSelected.encoding,
        contentType: indexSelected.contentType,
      });
    }
    const indexFile = Bun.file(indexPath);
    return serveFile(c, indexFile, NO_CACHE, { contentType: indexFile.type });
  };
}
