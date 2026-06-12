// GET /media/cover/:id, GET /media/audio/:id/*path, GET /media/file/:id/*path
// adapter.locateMedia が null なら404。non-null なら location.type に応じて配信する:
//   - "file": node:fs でストリーミング（real アダプタ）
//   - "synthetic": メモリ上で合成したコンテンツを配信（fixture アダプタ）
// audio は HTTP Range（206, Accept-Ranges, Content-Range）対応。
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { Hono } from "hono";
import type { DataAdapter, MediaLocation } from "../adapter.ts";
import { notFound } from "../lib/httpError.ts";

export function mediaRoute(adapter: DataAdapter): Hono {
  const app = new Hono();

  app.get("/media/cover/:id", async (c) => {
    const location = await adapter.locateMedia("cover", c.req.param("id"));
    if (!location) notFound(`カバー画像が見つかりません: ${c.req.param("id")}`);
    return streamWhole(location);
  });

  app.get("/media/audio/:id/:path{.+}", async (c) => {
    const location = await adapter.locateMedia("audio", c.req.param("id"), c.req.param("path"));
    if (!location) notFound(`音声ファイルが見つかりません: ${c.req.param("id")}/${c.req.param("path")}`);
    return streamWithRange(location, c.req.header("Range"));
  });

  app.get("/media/file/:id/:path{.+}", async (c) => {
    const location = await adapter.locateMedia("file", c.req.param("id"), c.req.param("path"));
    if (!location) notFound(`ファイルが見つかりません: ${c.req.param("id")}/${c.req.param("path")}`);
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
async function streamWhole(location: MediaLocation): Promise<Response> {
  if (location.type === "synthetic") {
    const body = location.read(0, location.size - 1);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": location.mime,
        "Content-Length": String(location.size),
      },
    });
  }

  const stats = await stat(location.absolutePath);
  const stream = Readable.toWeb(createReadStream(location.absolutePath)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": location.mime,
      "Content-Length": String(stats.size),
    },
  });
}

/** HTTP Range 対応のストリーミング（Range ヘッダーがあれば 206、無ければ 200） */
async function streamWithRange(location: MediaLocation, rangeHeader: string | undefined): Promise<Response> {
  const fileSize = await sizeOf(location);

  if (!rangeHeader) {
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

    const stream = Readable.toWeb(createReadStream(location.absolutePath)) as ReadableStream;
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

  const { start, end } = range;
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
    createReadStream(location.absolutePath, { start, end })
  ) as ReadableStream;

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

/** "bytes=start-end" 形式の Range ヘッダーをパースする。不正・範囲外なら null */
function parseRange(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return null;

  let start: number;
  let end: number;

  if (!startStr) {
    // "bytes=-N" → 末尾 N バイト
    const suffixLength = Number(endStr);
    if (suffixLength <= 0) return null;
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = Number(startStr);
    end = endStr ? Number(endStr) : fileSize - 1;
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) return null;

  return { start, end: Math.min(end, fileSize - 1) };
}
