import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  TRACK_NAMES,
  type SearchPresetMock,
  type SmartFolderMock,
  type SmartFolderRuleMock,
  type WorkSummaryMock,
} from "./fixtures";
import { createMockScenario } from "./scenarios";

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
    playlists: summary.trackCount > 0 ? [{ name: "default", tracks }] : [],
    resumePosition: 0,
    resumeTrackIndex: 0,
  };
}

function createMockState() {
  const now = new Date().toISOString();
  const scenario = createMockScenario(process.env.MIMIKAGO_MOCK_SCENARIO, now);
  return {
    scenarioId: scenario.id,
    works: scenario.works,
    presets: scenario.presets,
    smartFolders: scenario.smartFolders,
    rootFolder: scenario.rootFolder,
    lastScanTime: scenario.lastScanTime,
    scanNewWorkIds: scenario.scanNewWorkIds,
    nextPresetId: 4,
    nextSmartFolderId: 3,
  };
}

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

export function mockApiPlugin(): Plugin {
  const mockState = createMockState();

  return {
    name: "mock-api",
    configureServer(server) {
      server.middlewares.use(
        "/api",
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const url = req.url ?? "/";
          const urlPath = url.split("?")[0];
          const method = req.method ?? "GET";
          let params: Record<string, string> | null;

          if (method === "GET" && exactPath(urlPath, "/settings")) {
            return sendJson(res, {
              rootFolder: mockState.rootFolder,
              lastScanTime: mockState.lastScanTime,
            });
          }

          if (method === "POST" && exactPath(urlPath, "/settings")) {
            const body = await readBody(req);
            if (typeof body.rootFolder === "string") {
              mockState.rootFolder = body.rootFolder;
            }
            return sendNoContent(res);
          }

          if (method === "POST" && exactPath(urlPath, "/scan")) {
            mockState.lastScanTime = new Date().toISOString();
            return sendJson(res, {
              registered: mockState.works.length,
              newlyGenerated: mockState.scanNewWorkIds.length,
              errors: mockState.works.filter((w) => w.status === "error").length,
              missing: mockState.works.filter((w) => w.status === "missing").length,
              newWorkIds: mockState.scanNewWorkIds,
            });
          }

          if (method === "GET" && (params = matchPath(urlPath, "/library/axes/:axis"))) {
            const axis = params.axis;
            const PREFIX: Record<string, string> = {
              circle: "サークル/",
              cv: "cv/",
              series: "シリーズ/",
              cat: "カテゴリ/",
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

          if (method === "GET" && (params = matchPath(urlPath, "/library/smart-folders/:id"))) {
            const sf = mockState.smartFolders.find((s) => s.id === params!.id);
            return sf ? sendJson(res, sf) : sendNotFound(res);
          }

          if (method === "PUT" && (params = matchPath(urlPath, "/library/smart-folders/:id"))) {
            const body = await readBody(req);
            const idx = mockState.smartFolders.findIndex((s) => s.id === params!.id);
            if (idx < 0) return sendNotFound(res);
            mockState.smartFolders[idx] = { ...mockState.smartFolders[idx], ...body } as SmartFolderMock;
            return sendNoContent(res);
          }

          if (method === "DELETE" && (params = matchPath(urlPath, "/library/smart-folders/:id"))) {
            mockState.smartFolders = mockState.smartFolders.filter((s) => s.id !== params!.id);
            return sendNoContent(res);
          }

          if (method === "GET" && exactPath(urlPath, "/library/smart-folders")) {
            return sendJson(res, mockState.smartFolders);
          }

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
              circle: "サークル/",
              cv: "cv/",
              series: "シリーズ/",
              cat: "カテゴリ/",
            };

            let results = [...mockState.works];

            if (q) {
              const ql = q.toLowerCase();
              results = results.filter((w) =>
                w.title.toLowerCase().includes(ql) ||
                w.tags.some((t) => t.toLowerCase().includes(ql))
              );
            }

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

            if (axis && axisValue) {
              const prefix = PREFIX[axis] ?? (axis + "/");
              const full = prefix + axisValue;
              results = results.filter((w) => w.tags.some((t) => t === full || t === axisValue));
            }

            if (view === "recent") results = results.filter((w) => w.lastPlayedAt != null);
            else if (view === "added") {
              const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
              results = results.filter((w) => w.addedAt >= cutoff);
            }
            else if (view === "fav") results = results.filter((w) => w.bookmarked);
            else if (view === "unplayed") results = results.filter((w) => !w.lastPlayedAt && w.status === "ok");
            else if (view === "missing") results = results.filter((w) => w.status === "missing");

            if (sort === "title-asc") results.sort((a, b) => a.title.localeCompare(b.title, "ja"));
            else if (sort === "title-desc") results.sort((a, b) => b.title.localeCompare(a.title, "ja"));
            else if (sort === "added-asc") results.sort((a, b) => a.addedAt < b.addedAt ? -1 : 1);
            else if (sort === "added-desc") results.sort((a, b) => a.addedAt > b.addedAt ? -1 : 1);
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

          if (method === "GET" && matchPath(urlPath, "/works/:id/cover")) {
            return sendNotFound(res);
          }

          if (method === "GET" && (params = matchPath(urlPath, "/works/:id/files"))) {
            const work = mockState.works.find((w) => w.id === params!.id);
            if (!work) return sendJson(res, null);
            const children = Array.from({ length: work.trackCount }, (_, i) => ({
              name: `track${String(i + 1).padStart(2, "0")}.mp3`,
              path: `track${String(i + 1).padStart(2, "0")}.mp3`,
              isDir: false,
              size: 1024 * 1024 * (i + 1),
              fileType: "audio",
              children: [],
            }));
            return sendJson(res, {
              name: work.id,
              path: "",
              isDir: true,
              size: 0,
              fileType: "dir",
              children,
            });
          }

          if (method === "GET" && (params = matchPath(urlPath, "/works/:id"))) {
            const work = mockState.works.find((w) => w.id === params!.id);
            if (!work) return sendJson(res, null);
            return sendJson(res, buildFullWork(work));
          }

          if (method === "PUT" && (params = matchPath(urlPath, "/works/:id/tags"))) {
            const body = await readBody(req);
            const work = mockState.works.find((w) => w.id === params!.id);
            if (work && Array.isArray(body.tags)) {
              work.tags = body.tags as string[];
            }
            return sendNoContent(res);
          }

          if (method === "PUT" && (params = matchPath(urlPath, "/works/:id/title"))) {
            const body = await readBody(req);
            const work = mockState.works.find((w) => w.id === params!.id);
            if (work && typeof body.title === "string") {
              work.title = body.title;
            }
            return sendNoContent(res);
          }

          if (method === "POST" && (params = matchPath(urlPath, "/works/:id/bookmark"))) {
            const work = mockState.works.find((w) => w.id === params!.id);
            if (!work) return sendNotFound(res);
            work.bookmarked = !work.bookmarked;
            return sendJson(res, { bookmarked: work.bookmarked });
          }

          if (method === "POST" && (params = matchPath(urlPath, "/works/:id/last-played"))) {
            const work = mockState.works.find((w) => w.id === params!.id);
            if (work) work.lastPlayedAt = new Date().toISOString();
            return sendNoContent(res);
          }

          if (method === "POST" && matchPath(urlPath, "/works/:id/resume")) {
            return sendNoContent(res);
          }

          if (method === "GET" && exactPath(urlPath, "/tags")) {
            const allTags = [...new Set(mockState.works.flatMap((w) => w.tags))].sort();
            return sendJson(res, allTags);
          }

          if (method === "GET" && exactPath(urlPath, "/presets")) {
            return sendJson(res, mockState.presets);
          }

          if (method === "POST" && exactPath(urlPath, "/presets")) {
            const body = await readBody(req);
            const preset: SearchPresetMock = {
              id: mockState.nextPresetId++,
              name: (body.name as string) ?? "",
              query: (body.query as string) ?? "",
              tagFilters: (body.tagFilters as string[]) ?? [],
              sortId: (body.sortId as string) ?? "added-desc",
            };
            mockState.presets.push(preset);
            return sendJson(res, { id: preset.id });
          }

          if (method === "DELETE" && (params = matchPath(urlPath, "/presets/:id"))) {
            const id = Number(params.id);
            mockState.presets = mockState.presets.filter((p) => p.id !== id);
            return sendNoContent(res);
          }

          if (method === "POST" && exactPath(urlPath, "/export")) {
            const data = JSON.stringify({ version: 1, works: mockState.works }, null, 2);
            return sendJson(res, { data });
          }

          if (method === "GET" && urlPath.startsWith("/audio/")) {
            return sendNotFound(res);
          }

          if (method === "GET" && urlPath.startsWith("/files/")) {
            return sendNotFound(res);
          }

          if (method === "POST" && (params = matchPath(urlPath, "/dlsite/:workId/fetch"))) {
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

          if (method === "POST" && matchPath(urlPath, "/dlsite/:workId/apply")) {
            return sendNoContent(res);
          }

          next();
        }
      );
    },
  };
}
