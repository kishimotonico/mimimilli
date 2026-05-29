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
    tags: ["cv/水瀬なずな", "耳かき", "ASMR", "癒し系", "ソロ"],
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
    tags: ["cv/霧島レイ", "催眠", "バイノーラル", "誘導"],
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
    tags: ["cv/天音かなで", "添い寝", "ASMR", "シリーズ/添い寝ラジオ"],
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
    tags: ["cv/月城あかり", "バイノーラル", "読み聞かせ", "環境音", "ASMR"],
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
    tags: ["cv/水瀬なずな", "シチュエーションボイス", "日常系", "幼馴染"],
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
    tags: ["cv/霧島レイ", "ASMR", "囁き", "ソロ"],
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
    tags: ["cv/天音かなで", "cv/月城あかり", "フルボイス", "ファンタジー", "長編"],
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
    tags: ["cv/水瀬なずな", "ASMR", "マッサージ", "癒し系"],
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
    tags: ["cv/霧島レイ", "シチュエーションボイス", "ツンデレ", "後輩"],
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
    tags: ["cv/天音かなで", "ASMR", "癒し系"],
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

interface SmartFolderRuleMock {
  conjunction: string;
  field: string;
  operator: string;
  values: string[];
}
interface SmartFolderMock {
  id: string;
  name: string;
  rules: SmartFolderRuleMock[];
  sort: string;
  createdAt: string;
}

// 開発サーバー再起動でリセットされるインメモリ状態
const mockState = {
  works: INITIAL_WORKS.map((w) => ({ ...w })),
  presets: [
    { id: 1, name: "ASMR全般", query: "", tagFilters: ["ASMR"], sortId: "added-desc" },
    { id: 2, name: "水瀬なずな", query: "", tagFilters: ["cv/水瀬なずな"], sortId: "added-desc" },
    { id: 3, name: "催眠・誘導", query: "催眠", tagFilters: [], sortId: "title-asc" },
  ] as {
    id: number;
    name: string;
    query: string;
    tagFilters: string[];
    sortId: string;
  }[],
  smartFolders: [
    {
      id: "sf-1",
      name: "長時間 ASMR",
      rules: [
        { conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] },
        { conjunction: "AND", field: "タグ", operator: "∋", values: ["ASMR", "環境音"] },
      ],
      sort: "added-desc",
      createdAt: new Date().toISOString(),
    },
    {
      id: "sf-2",
      name: "水瀬なずな 全件",
      rules: [
        { conjunction: "WHERE", field: "タグ", operator: "∋", values: ["cv/水瀬なずな"] },
      ],
      sort: "added-desc",
      createdAt: new Date().toISOString(),
    },
  ] as SmartFolderMock[],
  rootFolder: "/mock/library" as string | null,
  lastScanTime: new Date().toISOString(),
  nextPresetId: 4,
  nextSmartFolderId: 3,
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

            // GET /api/library/axes/:axis
            if (method === "GET" && (params = matchPath(urlPath, "/library/axes/:axis"))) {
              const axis = params.axis;
              const PREFIX: Record<string, string> = {
                circle: "サークル/", cv: "cv/", series: "シリーズ/", cat: "カテゴリ/",
              };
              const prefix = PREFIX[axis];
              const counts = new Map<string, number>();
              for (const w of mockState.works) {
                if (axis === "tag") {
                  for (const t of w.tags) {
                    if (!t.includes("/")) counts.set(t, (counts.get(t) ?? 0) + 1);
                  }
                } else if (axis === "year") {
                  const yr = w.addedAt.slice(0, 4);
                  counts.set(yr, (counts.get(yr) ?? 0) + 1);
                } else if (prefix) {
                  for (const t of w.tags) {
                    if (t.startsWith(prefix)) {
                      const val = t.slice(prefix.length);
                      counts.set(val, (counts.get(val) ?? 0) + 1);
                    }
                  }
                }
              }
              const items = [...counts.entries()]
                .map(([value, count]) => ({ value, count }))
                .sort((a, b) => b.count - a.count);
              return sendJson(res, items);
            }

            // GET /api/library/smart-folders/:id/works
            if (method === "GET" && (params = matchPath(urlPath, "/library/smart-folders/:id/works"))) {
              const sf = mockState.smartFolders.find((s) => s.id === params!.id);
              if (!sf) return sendJson(res, []);
              let result = [...mockState.works];
              for (const rule of sf.rules) {
                if (rule.field === "タグ" && rule.operator === "∋") {
                  const vals = rule.values;
                  if (rule.conjunction === "AND NOT") {
                    result = result.filter((w) => !vals.some((v) => w.tags.includes(v)));
                  } else {
                    result = result.filter((w) => vals.some((v) => w.tags.includes(v)));
                  }
                } else if (rule.field === "長さ" && rule.operator === "≥") {
                  const minSec = parseInt(rule.values[0] ?? "0", 10);
                  result = result.filter((w) => w.totalDurationSec >= minSec);
                }
              }
              return sendJson(res, result);
            }

            // GET /api/library/smart-folders/:id
            if (method === "GET" && (params = matchPath(urlPath, "/library/smart-folders/:id"))) {
              const sf = mockState.smartFolders.find((s) => s.id === params!.id);
              return sf ? sendJson(res, sf) : sendNotFound(res);
            }

            // PUT /api/library/smart-folders/:id
            if (method === "PUT" && (params = matchPath(urlPath, "/library/smart-folders/:id"))) {
              const body = await readBody(req);
              const idx = mockState.smartFolders.findIndex((s) => s.id === params!.id);
              if (idx < 0) return sendNotFound(res);
              mockState.smartFolders[idx] = { ...mockState.smartFolders[idx], ...body } as SmartFolderMock;
              return sendNoContent(res);
            }

            // DELETE /api/library/smart-folders/:id
            if (method === "DELETE" && (params = matchPath(urlPath, "/library/smart-folders/:id"))) {
              mockState.smartFolders = mockState.smartFolders.filter((s) => s.id !== params!.id);
              return sendNoContent(res);
            }

            // GET /api/library/smart-folders
            if (method === "GET" && exactPath(urlPath, "/library/smart-folders")) {
              return sendJson(res, mockState.smartFolders);
            }

            // POST /api/library/smart-folders
            if (method === "POST" && exactPath(urlPath, "/library/smart-folders")) {
              const body = await readBody(req);
              const sf: SmartFolderMock = {
                id: `sf-${mockState.nextSmartFolderId++}`,
                name: (body.name as string) ?? "新規フォルダー",
                rules: (body.rules as SmartFolderRuleMock[]) ?? [],
                sort: (body.sort as string) ?? "added-desc",
                createdAt: new Date().toISOString(),
              };
              mockState.smartFolders.push(sf);
              return sendJson(res, sf, 201);
            }

            // GET /api/works
            if (method === "GET" && exactPath(urlPath, "/works")) {
              const qs = new URLSearchParams(url.includes("?") ? url.slice(url.indexOf("?") + 1) : "");
              const q = qs.get("q") ?? "";
              const tagsRaw = qs.get("tags") ?? "";
              const tagOp = (qs.get("tagOp") ?? "AND").toUpperCase();
              const axis = qs.get("axis") ?? "";
              const axisValue = qs.get("axisValue") ?? "";
              const view = qs.get("view") ?? "";
              const sort = qs.get("sort") ?? "added-desc";

              const PREFIX: Record<string, string> = {
                circle: "サークル/", cv: "cv/", series: "シリーズ/", cat: "カテゴリ/",
              };

              let results = [...mockState.works];

              // text search
              if (q) {
                const ql = q.toLowerCase();
                results = results.filter((w) =>
                  w.title.toLowerCase().includes(ql) ||
                  w.tags.some((t) => t.toLowerCase().includes(ql))
                );
              }

              // tag filter
              if (tagsRaw) {
                const tagList = tagsRaw.split(",").filter(Boolean);
                if (tagOp === "AND") {
                  results = results.filter((w) =>
                    tagList.every((tf) => w.tags.some((t) => t.toLowerCase().includes(tf.toLowerCase())))
                  );
                } else {
                  results = results.filter((w) =>
                    tagList.some((tf) => w.tags.some((t) => t.toLowerCase().includes(tf.toLowerCase())))
                  );
                }
              }

              // axis + axisValue filter
              if (axis && axisValue) {
                const prefix = PREFIX[axis] ?? (axis + "/");
                const full = prefix + axisValue;
                results = results.filter((w) => w.tags.some((t) => t === full || t === axisValue));
              }

              // view filter
              if (view === "recent") results = results.filter((w) => w.lastPlayedAt != null);
              else if (view === "added") {
                const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
                results = results.filter((w) => w.addedAt >= cutoff);
              }
              else if (view === "fav")      results = results.filter((w) => w.bookmarked);
              else if (view === "unplayed") results = results.filter((w) => !w.lastPlayedAt && w.status === "ok");
              else if (view === "missing")  results = results.filter((w) => w.status === "missing");

              // sort
              if (sort === "title-asc")       results.sort((a, b) => a.title.localeCompare(b.title, "ja"));
              else if (sort === "title-desc")  results.sort((a, b) => b.title.localeCompare(a.title, "ja"));
              else if (sort === "added-asc")   results.sort((a, b) => a.addedAt < b.addedAt ? -1 : 1);
              else if (sort === "added-desc")  results.sort((a, b) => a.addedAt > b.addedAt ? -1 : 1);
              else if (sort === "duration-asc") results.sort((a, b) => a.totalDurationSec - b.totalDurationSec);
              else if (sort === "duration-desc") results.sort((a, b) => b.totalDurationSec - a.totalDurationSec);
              else if (sort === "last-played") results.sort((a, b) => {
                if (!a.lastPlayedAt && !b.lastPlayedAt) return 0;
                if (!a.lastPlayedAt) return 1;
                if (!b.lastPlayedAt) return -1;
                return a.lastPlayedAt > b.lastPlayedAt ? -1 : 1;
              });

              return sendJson(res, results);
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
