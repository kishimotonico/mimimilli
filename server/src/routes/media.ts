// GET /media/cover/:id, GET /media/audio/:id/*path, GET /media/file/:id/*path
// adapter.locateMedia が null なら404。non-null なら location.type に応じて配信する:
//   - "file": node:fs でストリーミング（real アダプタ）
//   - "synthetic": メモリ上で合成したコンテンツを配信（fixture アダプタ）
// audio は HTTP Range（206, Accept-Ranges, Content-Range）対応。
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { Hono, type Context } from "hono";
import {
  coverQuerySchema,
  normalizeThumbnailWidth,
  workspaceMediaQuerySchema,
} from "@mimimilli/shared";
import type { CoverDescriptor, DataAdapter, MediaLocation } from "../adapter/index.ts";
import { invalidRequest, notFound } from "../lib/httpError.ts";

type BunServerLike = { timeout?: (req: Request, seconds: number) => void };

/**
 * Bunのidle timeoutは配信中のストリーミング接続にも適用されるため、リクエスト単位で無効化する。
 * fixture開発経路（Bun Serverなし）では何もしない。
 *
 * hono/bunのgetBunServerはグローバルBunを評価時に参照しNode実行下でimportできないため、
 * その実体（c.envからBun Serverを取り出すだけの処理）をここに直接書く。
 */
function disableIdleTimeout(c: Context): void {
  if (!c.env) return;
  const env = c.env as { server?: BunServerLike } & BunServerLike;
  const server = "server" in env ? env.server : env;
  if (server && typeof server.timeout === "function") {
    server.timeout(c.req.raw, 0);
  }
}

/** 開放端Range（bytes=N-）を打ち切る上限チャンクサイズ。 */
const DEFAULT_CHUNK_SIZE_BYTES = 8 * 1024 * 1024;

export type MediaRouteOptions = { chunkSizeBytes?: number };

export function mediaRoute(adapter: DataAdapter, options: MediaRouteOptions = {}): Hono {
  const app = new Hono();
  const chunkSizeBytes = options.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE_BYTES;

  app.get("/media/cover/:id", async (c) => {
    disableIdleTimeout(c);
    const parsed = coverQuerySchema.safeParse(c.req.query());
    if (!parsed.success) invalidRequest(`不正なクエリパラメータです: ${parsed.error.message}`);
    const width = parsed.data.w === undefined ? undefined : normalizeThumbnailWidth(parsed.data.w);

    const descriptor = await adapter.describeCover(c.req.param("id"), width);
    if (!descriptor) notFound(`カバー画像が見つかりません: ${c.req.param("id")}`);
    const cacheHeaders = coverCacheHeaders(descriptor);
    if (
      isNotModified(c.req.header("If-None-Match"), c.req.header("If-Modified-Since"), descriptor)
    ) {
      return new Response(null, { status: 304, headers: cacheHeaders });
    }
    const location = await descriptor.materialize();
    return streamWhole(location, cacheHeaders);
  });

  app.get("/media/workspace", async (c) => {
    disableIdleTimeout(c);
    const parsed = workspaceMediaQuerySchema.safeParse(c.req.query());
    if (!parsed.success) invalidRequest(`不正なクエリパラメータです: ${parsed.error.message}`);
    const media = await adapter.locateWorkspaceMedia({ kind: "workspace", path: parsed.data.path });
    if (!media) notFound(`ファイルが見つかりません: ${parsed.data.path}`);
    if (media.preview.kind === "unavailable") notFound(`プレビューできません: ${parsed.data.path}`);
    return streamWithRange(media.location, c.req.header("Range"), chunkSizeBytes, media.maxBytes);
  });

  app.get("/media/audio/:id/:path{.+}", async (c) => {
    disableIdleTimeout(c);
    const location = await adapter.locateMedia("audio", c.req.param("id"), c.req.param("path"));
    if (!location)
      notFound(`音声ファイルが見つかりません: ${c.req.param("id")}/${c.req.param("path")}`);
    return streamWithRange(location, c.req.header("Range"), chunkSizeBytes);
  });

  app.get("/media/file/:id/:path{.+}", async (c) => {
    disableIdleTimeout(c);
    const location = await adapter.locateMedia("file", c.req.param("id"), c.req.param("path"));
    if (!location)
      notFound(`ファイルが見つかりません: ${c.req.param("id")}/${c.req.param("path")}`);
    return streamWhole(location);
  });

  return app;
}

/** location のサイズを取得する（"file" は stat、"synthetic" は size プロパティ） */
async function sizeOf(location: MediaLocation): Promise<number> {
  if (location.type === "synthetic") return location.size;
  const stats = await stat(location.absolutePath);
  return stats.size;
}

/** Range 非対応の通常ストリーミング（200） */
async function streamWhole(
  location: MediaLocation,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  if (location.type === "synthetic") {
    const body = location.read(0, location.size - 1);
    return new Response(body, {
      status: 200,
      headers: {
        ...extraHeaders,
        "Content-Type": location.mime,
        "Content-Length": String(location.size),
      },
    });
  }

  const size = location.size ?? (await stat(location.absolutePath)).size;
  const stream = Readable.toWeb(
    createReadStream(location.absolutePath),
  ) as unknown as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: {
      ...extraHeaders,
      "Content-Type": location.mime,
      "Content-Length": String(size),
    },
  });
}

function coverCacheHeaders(descriptor: CoverDescriptor): Record<string, string> {
  return {
    ETag: descriptor.etag,
    "Last-Modified": new Date(Math.floor(descriptor.lastModifiedMs / 1000) * 1000).toUTCString(),
    "Cache-Control": "private, max-age=0, must-revalidate",
  };
}

/** If-None-Matchはweak比較。ヘッダーが存在する場合はIMSを評価しない。 */
function isNotModified(
  ifNoneMatch: string | undefined,
  ifModifiedSince: string | undefined,
  descriptor: CoverDescriptor,
): boolean {
  if (ifNoneMatch !== undefined) return etagMatches(ifNoneMatch, descriptor.etag);
  if (ifModifiedSince === undefined) return false;
  const modifiedSince = Date.parse(ifModifiedSince);
  return !Number.isNaN(modifiedSince) && descriptor.lastModifiedMs <= modifiedSince;
}

function etagMatches(header: string, current: string): boolean {
  const currentOpaque = stripWeakPrefix(current);
  return header.split(",").some((candidate) => {
    const trimmed = candidate.trim();
    return trimmed === "*" || stripWeakPrefix(trimmed) === currentOpaque;
  });
}

function stripWeakPrefix(etag: string): string {
  return etag.replace(/^W\//i, "");
}

/** HTTP Range 対応のストリーミング（Range ヘッダーがあれば 206、無ければ 200） */
async function streamWithRange(
  location: MediaLocation,
  rangeHeader: string | undefined,
  chunkSizeBytes: number,
  maxBytes?: number,
): Promise<Response> {
  const fileSize = Math.min(await sizeOf(location), maxBytes ?? Number.POSITIVE_INFINITY);

  if (!rangeHeader) {
    if (fileSize === 0) {
      return new Response(null, {
        status: 200,
        headers: {
          "Content-Type": location.mime,
          "Content-Length": "0",
          "Accept-Ranges": "bytes",
        },
      });
    }
    if (location.type === "synthetic") {
      const body = location.read(0, fileSize - 1);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": location.mime,
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
        },
      });
    }

    const stream = Readable.toWeb(
      createReadStream(location.absolutePath, { start: 0, end: fileSize - 1 }),
    ) as unknown as ReadableStream;
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": location.mime,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const range = parseRange(rangeHeader, fileSize);
  if (!range) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  const start = range.start;
  const end = range.openEnded ? Math.min(range.end, start + chunkSizeBytes - 1) : range.end;
  const chunkSize = end - start + 1;

  if (location.type === "synthetic") {
    const body = location.read(start, end);
    return new Response(body, {
      status: 206,
      headers: {
        "Content-Type": location.mime,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  const stream = Readable.toWeb(
    createReadStream(location.absolutePath, { start, end }),
  ) as unknown as ReadableStream;

  return new Response(stream, {
    status: 206,
    headers: {
      "Content-Type": location.mime,
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
    },
  });
}

type ParsedRange = { start: number; end: number; openEnded: boolean };

/** "bytes=start-end" 形式の Range ヘッダーをパースする。不正・範囲外なら null */
function parseRange(rangeHeader: string, fileSize: number): ParsedRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return null;

  let start: number;
  let end: number;
  let openEnded: boolean;

  if (!startStr) {
    // "bytes=-N" → 末尾 N バイト（要求量が明示されているので打ち切り対象にしない）
    const suffixLength = Number(endStr);
    if (suffixLength <= 0) return null;
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
    openEnded = false;
  } else {
    start = Number(startStr);
    openEnded = !endStr;
    end = endStr ? Number(endStr) : fileSize - 1;
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) return null;

  return { start, end: Math.min(end, fileSize - 1), openEnded };
}
