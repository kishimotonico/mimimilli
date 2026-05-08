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
    id: "RJ412801",
    title: "【ASMR】深夜の耳かき屋さん 〜あなただけの特別な時間〜",
    coverImage: "cover.jpg",
    status: "ok",
    physicalPath: "/mock/RJ412801",
    totalDurationSec: 3723,
    addedAt: "2024-03-10T00:00:00Z",
    errorMessage: null,
    urls: [
      {
        label: "DLsite",
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ412801.html",
      },
    ],
    tags: ["CV:水瀬なずな", "耳かき", "ASMR", "癒し系", "ソロ"],
    trackCount: 4,
    bookmarked: true,
    lastPlayedAt: "2024-12-01T10:00:00Z",
  },
  {
    id: "RJ389054",
    title: "催眠音声「深く、もっと深く」〜あなたの意識を手放して〜",
    coverImage: null,
    status: "ok",
    physicalPath: "/mock/RJ389054",
    totalDurationSec: 5460,
    addedAt: "2024-04-22T00:00:00Z",
    errorMessage: null,
    urls: [
      {
        label: "DLsite",
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ389054.html",
      },
    ],
    tags: ["CV:霧島レイ", "催眠", "バイノーラル", "誘導"],
    trackCount: 3,
    bookmarked: true,
    lastPlayedAt: "2024-11-15T22:30:00Z",
  },
  {
    id: "RJ401237",
    title: "お姉さんの添い寝ラジオ Season2 vol.3",
    coverImage: null,
    status: "ok",
    physicalPath: "/mock/RJ401237",
    totalDurationSec: 2880,
    addedAt: "2024-05-18T00:00:00Z",
    errorMessage: null,
    urls: [
      {
        label: "DLsite",
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ401237.html",
      },
    ],
    tags: ["CV:天音かなで", "添い寝", "ASMR", "シリーズ:添い寝ラジオ"],
    trackCount: 2,
    bookmarked: false,
    lastPlayedAt: "2024-10-05T23:00:00Z",
  },
  {
    id: "RJ356789",
    title: "【バイノーラル録音】雨音と読み聞かせ〜嵐の夜に〜",
    coverImage: null,
    status: "ok",
    physicalPath: "/mock/RJ356789",
    totalDurationSec: 4200,
    addedAt: "2024-01-07T00:00:00Z",
    errorMessage: null,
    urls: [],
    tags: ["CV:月城あかり", "バイノーラル", "読み聞かせ", "環境音", "ASMR"],
    trackCount: 5,
    bookmarked: false,
    lastPlayedAt: "2024-08-20T21:00:00Z",
  },
  {
    id: "RJ445612",
    title: "幼馴染の彼女と過ごす休日【シチュエーションボイス】",
    coverImage: null,
    status: "ok",
    physicalPath: "/mock/RJ445612",
    totalDurationSec: 3060,
    addedAt: "2024-07-30T00:00:00Z",
    errorMessage: null,
    urls: [
      {
        label: "DLsite",
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ445612.html",
      },
    ],
    tags: ["CV:水瀬なずな", "シチュエーションボイス", "日常系", "幼馴染"],
    trackCount: 6,
    bookmarked: true,
    lastPlayedAt: "2025-01-10T20:00:00Z",
  },
  {
    id: "RJ378923",
    title: "耳元でこっそり〜内緒話ASMR〜",
    coverImage: null,
    status: "ok",
    physicalPath: "/mock/RJ378923",
    totalDurationSec: 1980,
    addedAt: "2024-02-14T00:00:00Z",
    errorMessage: null,
    urls: [],
    tags: ["CV:霧島レイ", "ASMR", "囁き", "ソロ"],
    trackCount: 3,
    bookmarked: false,
    lastPlayedAt: null,
  },
  {
    id: "RJ421088",
    title: "【長編】異世界転生した僕の専属魔法使いになってくれた彼女の話（フルボイス）",
    coverImage: null,
    status: "ok",
    physicalPath: "/mock/RJ421088",
    totalDurationSec: 9840,
    addedAt: "2024-06-03T00:00:00Z",
    errorMessage: null,
    urls: [
      {
        label: "DLsite",
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ421088.html",
      },
    ],
    tags: ["CV:天音かなで", "CV:月城あかり", "フルボイス", "ファンタジー", "長編"],
    trackCount: 12,
    bookmarked: false,
    lastPlayedAt: "2024-09-01T19:00:00Z",
  },
  {
    id: "RJ398201",
    title: "マッサージ師さんのASMR施術音声",
    coverImage: null,
    status: "ok",
    physicalPath: "/mock/RJ398201",
    totalDurationSec: 2640,
    addedAt: "2024-03-28T00:00:00Z",
    errorMessage: null,
    urls: [],
    tags: ["CV:水瀬なずな", "ASMR", "マッサージ", "癒し系"],
    trackCount: 3,
    bookmarked: false,
    lastPlayedAt: "2024-07-14T22:00:00Z",
  },
  {
    id: "RJ460011",
    title: "【新作】ツンデレ後輩ちゃんの秘密のお世話ボイス",
    coverImage: "cover.jpg",
    status: "ok",
    physicalPath: "/mock/RJ460011",
    totalDurationSec: 2100,
    addedAt: "2025-01-15T00:00:00Z",
    errorMessage: null,
    urls: [
      {
        label: "DLsite",
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ460011.html",
      },
    ],
    tags: ["CV:霧島レイ", "シチュエーションボイス", "ツンデレ", "後輩"],
    trackCount: 4,
    bookmarked: false,
    lastPlayedAt: null,
  },
  {
    id: "RJ334567",
    title: "眠れない夜のための環境音コレクション〜森・雨・波〜",
    coverImage: null,
    status: "ok",
    physicalPath: "/mock/RJ334567",
    totalDurationSec: 10800,
    addedAt: "2023-11-20T00:00:00Z",
    errorMessage: null,
    urls: [],
    tags: ["環境音", "睡眠用", "BGM"],
    trackCount: 6,
    bookmarked: false,
    lastPlayedAt: "2024-05-30T00:30:00Z",
  },
  {
    id: "RJ499999",
    title: "メタデータ読み込みエラーの作品（ffprobeが見つかりません）",
    coverImage: null,
    status: "error",
    physicalPath: "/mock/RJ499999",
    totalDurationSec: 0,
    addedAt: "2024-11-01T00:00:00Z",
    errorMessage: "メタデータの生成に失敗しました: ffprobe が見つかりません",
    urls: [],
    tags: [],
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
  },
  {
    id: "RJ311234",
    title: "お気に入りの作品（フォルダー移動済み・行方不明）",
    coverImage: null,
    status: "missing",
    physicalPath: "/mock/RJ311234",
    totalDurationSec: 3300,
    addedAt: "2023-08-05T00:00:00Z",
    errorMessage: null,
    urls: [
      {
        label: "DLsite",
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ311234.html",
      },
    ],
    tags: ["CV:天音かなで", "ASMR", "癒し系"],
    trackCount: 3,
    bookmarked: true,
    lastPlayedAt: "2024-01-20T21:00:00Z",
  },
];

// 作品IDごとのトラック名定義（未定義の場合は汎用名にフォールバック）
const TRACK_NAMES: Record<string, string[]> = {
  RJ412801: ["【前半】耳かきとマッサージ", "【後半】囁きと吐息", "おまけ〜あなただけに〜", "SE素材集"],
  RJ389054: ["導入〜意識を手放して〜", "深化〜深淵へ〜", "覚醒〜穏やかな目覚め〜"],
  RJ401237: ["本編 前半", "本編 後半"],
  RJ356789: ["雨音〜窓辺で〜", "読み聞かせ「雨の詩」", "嵐の夜の環境音", "囁き読み〜続き〜", "おやすみの言葉"],
  RJ445612: [
    "朝のごあいさつ", "一緒にお昼ごはん", "午後のまったり時間",
    "夕暮れの散歩", "夜のトーク", "おやすみなさい",
  ],
  RJ378923: ["こっそり話しかけてみた", "もっと近くで", "また明日ね"],
  RJ421088: [
    "第一章：異世界への召喚", "第二章：魔法使いとの出会い", "第三章：修行の日々",
    "第四章：初めての実戦", "第五章：彼女の秘密", "第六章：王都での試練",
    "第七章：裏切りと真実", "第八章：決戦前夜", "第九章：最終決戦",
    "第十章：新たな旅立ち", "エピローグ", "特典ボイス",
  ],
  RJ398201: ["首・肩コース", "背中・腰コース", "フルボディコース"],
  RJ460011: ["ツンな日常", "デレの瞬間", "お世話の時間", "おやすみの言葉（照れ気味）"],
  RJ334567: ["森の朝（バードコール付き）", "小雨〜穏やかな午後〜", "波音〜夕暮れの海辺〜",
    "大雨〜嵐の夜〜", "焚き火〜冬の夜〜", "虫の音〜夏の夜〜"],
  RJ311234: ["本編1", "本編2", "特典"],
};

function buildFullWork(summary: WorkSummaryMock) {
  const namedTracks = TRACK_NAMES[summary.id];
  const tracks = Array.from({ length: summary.trackCount }, (_, i) => ({
    title: namedTracks?.[i] ?? `Track ${i + 1}`,
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
  presets: [
    { id: 1, name: "ASMR全般", query: "", tagFilters: ["ASMR"], sortId: "added-desc" },
    { id: 2, name: "水瀬なずな", query: "", tagFilters: ["CV:水瀬なずな"], sortId: "added-desc" },
    { id: 3, name: "催眠・誘導", query: "催眠", tagFilters: [], sortId: "title-asc" },
  ] as {
    id: number;
    name: string;
    query: string;
    tagFilters: string[];
    sortId: string;
  }[],
  rootFolder: "/mock/library" as string | null,
  lastScanTime: new Date().toISOString(),
  nextPresetId: 4,
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
