/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

// ---------------------------------------------------------------------------
// モックデータ（開発用）
// ---------------------------------------------------------------------------

interface WorkSummaryMock {
  id: string;
  title: string;
  coverImage: string | null;
  status: string;
  physicalPath: string;
  totalDurationSec: number;
  addedAt: string;
  errorMessage: string | null;
  urls: { label: string; url: string }[];
  tags: string[];
  trackCount: number;
  bookmarked: boolean;
  lastPlayedAt: string | null;
}

const INITIAL_WORKS: WorkSummaryMock[] = [
  {
    id: "RJ001001",
    title: "サンプル作品1 〜癒しのひとときASMR〜",
    coverImage: "cover.jpg",
    status: "ok",
    physicalPath: "/mock/RJ001001",
    totalDurationSec: 3723,
    addedAt: "2024-06-01T00:00:00Z",
    errorMessage: null,
    urls: [],
    tags: ["CV:テスト太郎", "癒し系", "ASMR"],
    trackCount: 3,
    bookmarked: true,
    lastPlayedAt: "2024-12-01T10:00:00Z",
  },
  {
    id: "RJ002002",
    title: "サンプル作品2 〜長いタイトルのテスト用作品〜",
    coverImage: null,
    status: "ok",
    physicalPath: "/mock/RJ002002",
    totalDurationSec: 1830,
    addedAt: "2024-07-15T00:00:00Z",
    errorMessage: null,
    urls: [
      {
        label: "DLsite",
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ002002.html",
      },
    ],
    tags: ["CV:テスト花子", "バイノーラル"],
    trackCount: 2,
    bookmarked: false,
    lastPlayedAt: null,
  },
  {
    id: "RJ003003",
    title: "サンプル作品3",
    coverImage: null,
    status: "ok",
    physicalPath: "/mock/RJ003003",
    totalDurationSec: 900,
    addedAt: "2024-08-20T00:00:00Z",
    errorMessage: null,
    urls: [],
    tags: ["催眠", "ASMR", "CV:テスト太郎"],
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: "2024-11-20T20:00:00Z",
  },
  {
    id: "RJ004004",
    title: "エラー作品（メタデータ生成失敗）",
    coverImage: null,
    status: "error",
    physicalPath: "/mock/RJ004004",
    totalDurationSec: 0,
    addedAt: "2024-09-01T00:00:00Z",
    errorMessage: "メタデータの生成に失敗しました: ffprobe が見つかりません",
    urls: [],
    tags: [],
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
  },
  {
    id: "RJ005005",
    title: "行方不明作品（フォルダー削除済み）",
    coverImage: null,
    status: "missing",
    physicalPath: "/mock/RJ005005",
    totalDurationSec: 1200,
    addedAt: "2024-10-01T00:00:00Z",
    errorMessage: null,
    urls: [],
    tags: ["CV:テスト花子"],
    trackCount: 2,
    bookmarked: false,
    lastPlayedAt: null,
  },
];

function buildFullWork(summary: WorkSummaryMock) {
  const tracks = Array.from({ length: summary.trackCount }, (_, i) => ({
    title: `Track ${i + 1}`,
    file: `track${String(i + 1).padStart(2, "0")}.mp3`,
  }));
  return {
    ...summary,
    defaultPlaylist: "default",
    createdAt: summary.addedAt,
    playlists:
      summary.trackCount > 0 ? [{ name: "default", tracks }] : [],
    resumePosition: 0,
    resumeTrackIndex: 0,
  };
}

// 開発サーバー再起動でリセットされるインメモリ状態
const mockState = {
  works: INITIAL_WORKS.map((w) => ({ ...w })),
  presets: [] as {
    id: number;
    name: string;
    query: string;
    tagFilters: string[];
    sortId: string;
  }[],
  rootFolder: "/mock/library" as string | null,
  lastScanTime: new Date().toISOString(),
  nextPresetId: 1,
};

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function matchPath(url: string, pattern: string): Record<string, string> | null {
  const names: string[] = [];
  const regexStr =
    "^" +
    pattern.replace(/:([a-z_]+)/g, (_, name: string) => {
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

function exactPath(url: string, pattern: string): boolean {
  return url === pattern || url.startsWith(pattern + "?");
}

function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendNoContent(res: ServerResponse) {
  res.writeHead(204);
  res.end();
}

function sendNotFound(res: ServerResponse) {
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
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

// ---------------------------------------------------------------------------
// Vite 設定
// ---------------------------------------------------------------------------

// BACKEND_URL が設定されていれば本物のサーバーにプロキシ、なければモックを使う
// 例: BACKEND_URL=http://localhost:8080 pnpm dev
const backendUrl = process.env.BACKEND_URL;

export default defineConfig({
  plugins: [
    react(),
    !backendUrl && {
      name: "mock-api",
      configureServer(server) {
        server.middlewares.use(
          "/api",
          async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
            const url = req.url ?? "/";
            const urlPath = url.split("?")[0];
            const method = req.method ?? "GET";
            let params: Record<string, string> | null;

            // GET /api/settings
            if (method === "GET" && exactPath(urlPath, "/settings")) {
              return sendJson(res, {
                rootFolder: mockState.rootFolder,
                lastScanTime: mockState.lastScanTime,
              });
            }

            // POST /api/settings
            if (method === "POST" && exactPath(urlPath, "/settings")) {
              const body = await readBody(req);
              if (typeof body.rootFolder === "string") {
                mockState.rootFolder = body.rootFolder;
              }
              return sendNoContent(res);
            }

            // POST /api/scan
            if (method === "POST" && exactPath(urlPath, "/scan")) {
              mockState.lastScanTime = new Date().toISOString();
              return sendJson(res, {
                registered: mockState.works.length,
                newlyGenerated: 0,
                errors: mockState.works.filter((w) => w.status === "error").length,
                missing: mockState.works.filter((w) => w.status === "missing").length,
                newWorkIds: [],
              });
            }

            // GET /api/works
            if (method === "GET" && exactPath(urlPath, "/works")) {
              return sendJson(res, mockState.works);
            }

            // GET /api/works/:id/cover
            if (method === "GET" && (params = matchPath(urlPath, "/works/:id/cover"))) {
              // モックでは画像ファイルなし → 404（フロントがプレースホルダー表示）
              return sendNotFound(res);
            }

            // GET /api/works/:id/files
            if (method === "GET" && (params = matchPath(urlPath, "/works/:id/files"))) {
              const work = mockState.works.find((w) => w.id === params!.id);
              if (!work) return sendJson(res, null);
              const children = Array.from(
                { length: work.trackCount },
                (_, i) => ({
                  name: `track${String(i + 1).padStart(2, "0")}.mp3`,
                  path: `track${String(i + 1).padStart(2, "0")}.mp3`,
                  isDir: false,
                  size: 1024 * 1024 * (i + 1),
                  fileType: "audio",
                  children: [],
                })
              );
              return sendJson(res, {
                name: work.id,
                path: "",
                isDir: true,
                size: 0,
                fileType: "dir",
                children,
              });
            }

            // GET /api/works/:id
            if (method === "GET" && (params = matchPath(urlPath, "/works/:id"))) {
              const work = mockState.works.find((w) => w.id === params!.id);
              if (!work) return sendJson(res, null);
              return sendJson(res, buildFullWork(work));
            }

            // PUT /api/works/:id/tags
            if (method === "PUT" && (params = matchPath(urlPath, "/works/:id/tags"))) {
              const body = await readBody(req);
              const work = mockState.works.find((w) => w.id === params!.id);
              if (work && Array.isArray(body.tags)) {
                work.tags = body.tags as string[];
              }
              return sendNoContent(res);
            }

            // PUT /api/works/:id/title
            if (method === "PUT" && (params = matchPath(urlPath, "/works/:id/title"))) {
              const body = await readBody(req);
              const work = mockState.works.find((w) => w.id === params!.id);
              if (work && typeof body.title === "string") {
                work.title = body.title;
              }
              return sendNoContent(res);
            }

            // POST /api/works/:id/bookmark
            if (
              method === "POST" &&
              (params = matchPath(urlPath, "/works/:id/bookmark"))
            ) {
              const work = mockState.works.find((w) => w.id === params!.id);
              if (!work) return sendNotFound(res);
              work.bookmarked = !work.bookmarked;
              return sendJson(res, { bookmarked: work.bookmarked });
            }

            // POST /api/works/:id/last-played
            if (
              method === "POST" &&
              (params = matchPath(urlPath, "/works/:id/last-played"))
            ) {
              const work = mockState.works.find((w) => w.id === params!.id);
              if (work) work.lastPlayedAt = new Date().toISOString();
              return sendNoContent(res);
            }

            // POST /api/works/:id/resume
            if (
              method === "POST" &&
              (params = matchPath(urlPath, "/works/:id/resume"))
            ) {
              return sendNoContent(res);
            }

            // GET /api/tags
            if (method === "GET" && exactPath(urlPath, "/tags")) {
              const allTags = [
                ...new Set(mockState.works.flatMap((w) => w.tags)),
              ].sort();
              return sendJson(res, allTags);
            }

            // GET /api/presets
            if (method === "GET" && exactPath(urlPath, "/presets")) {
              return sendJson(res, mockState.presets);
            }

            // POST /api/presets
            if (method === "POST" && exactPath(urlPath, "/presets")) {
              const body = await readBody(req);
              const preset = {
                id: mockState.nextPresetId++,
                name: (body.name as string) ?? "",
                query: (body.query as string) ?? "",
                tagFilters: (body.tagFilters as string[]) ?? [],
                sortId: (body.sortId as string) ?? "added-desc",
              };
              mockState.presets.push(preset);
              return sendJson(res, { id: preset.id });
            }

            // DELETE /api/presets/:id
            if (
              method === "DELETE" &&
              (params = matchPath(urlPath, "/presets/:id"))
            ) {
              const id = Number(params.id);
              mockState.presets = mockState.presets.filter((p) => p.id !== id);
              return sendNoContent(res);
            }

            // POST /api/export
            if (method === "POST" && exactPath(urlPath, "/export")) {
              const data = JSON.stringify(
                { version: 1, works: mockState.works },
                null,
                2
              );
              return sendJson(res, { data });
            }

            // GET /api/audio/:workId/* — モックでは音声ファイルなし
            if (method === "GET" && urlPath.startsWith("/audio/")) {
              return sendNotFound(res);
            }

            // GET /api/files/:workId/* — モックではファイルなし
            if (method === "GET" && urlPath.startsWith("/files/")) {
              return sendNotFound(res);
            }

            // POST /api/dlsite/:workId/fetch
            if (
              method === "POST" &&
              (params = matchPath(urlPath, "/dlsite/:workId/fetch"))
            ) {
              return sendJson(res, {
                rjCode: params.workId,
                title: `（モック）${params.workId}`,
                circle: "モックサークル",
                cvs: ["モックCV"],
                genreTags: ["テスト"],
                coverUrl: null,
                url: `https://www.dlsite.com/maniax/work/=/product_id/${params.workId}.html`,
              });
            }

            // POST /api/dlsite/:workId/apply
            if (
              method === "POST" &&
              (params = matchPath(urlPath, "/dlsite/:workId/apply"))
            ) {
              return sendNoContent(res);
            }

            next();
          }
        );
      },
    },
  ].filter(Boolean),

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },

  server: {
    proxy: backendUrl
      ? { "/api": { target: backendUrl, changeOrigin: true } }
      : undefined,
  },
});
