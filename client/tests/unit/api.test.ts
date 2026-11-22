import { describe, it, expect, vi, beforeEach } from "vitest";
import * as workApi from "../../src/entities/work/api";
import * as smartFolderApi from "../../src/entities/smart-folder/api";
import * as filesApi from "../../src/features/files/api";
import * as libraryApi from "../../src/features/library/api";
import * as settingsApi from "../../src/features/settings/api";
import * as scanEntityApi from "../../src/entities/scan/api";
import {
  SCAN_CANDIDATE_REGISTER_MAX_PATHS,
  emptyDlsiteState,
  emptyMetaDlsiteState,
  scanCandidatesRegisterRequestSchema,
  workspacePath,
  type Work,
  type WorkListItem,
  type WorkSummary,
} from "@mimimilli/shared";
import { coverFieldsFromCover } from "../helpers/cover";

const mockFetch = vi.mocked(fetch);

function makeResponse(data: unknown, status = 200) {
  const body = data === null || status === 204 ? "" : JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(body),
  } as Response;
}

/** workSchema/workSummarySchema に適合する最小のfixtureを作る（レスポンス検証テスト用） */
function makeWorkSummary(overrides: Partial<WorkSummary> = {}): WorkSummary {
  return {
    id: "work-1",
    title: "テスト作品",
    cover: null,
    status: "ok",
    physicalPath: "/library/work-1",
    totalDurationSec: 120,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    ...overrides,
  };
}

function makeWorkListItem(overrides: Partial<WorkListItem> = {}): WorkListItem {
  return {
    id: "work-1",
    title: "テスト作品",
    cover: null,
    status: "ok",
    totalDurationSec: 120,
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    circleName: null,
    relativePath: workspacePath("work-1"),
    dlsite: { rjCode: null, status: "none" },
    ...overrides,
  };
}

function makeWork(overrides: Partial<Work> = {}): Work {
  const { trackCount: _trackCount, ...summary } = makeWorkSummary();
  const { coverKind, coverImage } = coverFieldsFromCover(summary.cover);
  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  return {
    ...summary,
    coverKind,
    coverImage,
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            title: "track1",
            file: "track1.mp3",
            durationSec: 120,
            durationKind: "resolved",
          },
        ],
      },
    ],
    resume: null,
    ...overrides,
  };
}

describe("settings api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("getSettings returns rootFolder from /api/settings", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({
        rootFolder: "/test/path",
        lastScanTime: null,
        rootReconfiguration: { status: "idle", completedAt: null },
      }),
    );
    const result = await settingsApi.getSettings();
    expect(mockFetch).toHaveBeenCalledWith("/api/settings");
    expect(result.rootFolder).toBe("/test/path");
    expect(result.rootReconfiguration).toEqual({ status: "idle", completedAt: null });
  });

  it("getRootReconfiguration GETs /api/root-reconfiguration", async () => {
    const failed = { status: "failed", rootFolder: "/new/path", message: "読み取れません" };
    mockFetch.mockResolvedValue(makeResponse(failed));
    await expect(settingsApi.getRootReconfiguration()).resolves.toEqual(failed);
    expect(mockFetch).toHaveBeenCalledWith("/api/root-reconfiguration");
  });

  it("startRootReconfiguration POSTs to /api/root-reconfiguration", async () => {
    const running = { status: "running", rootFolder: "/new/path", progress: null };
    mockFetch.mockResolvedValue(makeResponse(running, 202));
    await expect(settingsApi.startRootReconfiguration("/new/path")).resolves.toEqual(running);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/root-reconfiguration",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ rootFolder: "/new/path" }),
      }),
    );
  });
});

describe("scan api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("startScan POSTs to /api/scan", async () => {
    const mockResult = {
      job: {
        id: "job-1",
        status: "running",
        createdAt: "2026-01-01T00:00:00.000Z",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: null,
        progress: null,
        error: null,
      },
    };
    mockFetch.mockResolvedValue(makeResponse(mockResult, 202));
    const result = await scanEntityApi.startScan();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/scan",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(mockResult.job);
  });

  it("startScan: full:true はJSONボディを送る", async () => {
    const mockResult = {
      job: {
        id: "job-2",
        status: "running",
        createdAt: "2026-01-01T00:00:00.000Z",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: null,
        progress: null,
        error: null,
      },
    };
    mockFetch.mockResolvedValue(makeResponse(mockResult, 202));
    await scanEntityApi.startScan({ full: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/scan",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ full: true }),
      }),
    );
  });

  it("startScan: 409はScanAlreadyActiveErrorとしてactive jobを保持する", async () => {
    const active = {
      id: "job-1",
      status: "running" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: null,
      progress: null,
      error: null,
    };
    mockFetch.mockResolvedValue(
      makeResponse({ error: { code: "conflict", message: "already active" }, active }, 409),
    );
    await expect(scanEntityApi.startScan()).rejects.toMatchObject({
      status: 409,
      code: "conflict",
      active,
    });
  });

  it("startScan: 500はサーバーのcode/messageをApiRequestErrorとして保持する", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: { code: "internal", message: "start failed" } }, 500),
    );
    await expect(scanEntityApi.startScan()).rejects.toMatchObject({
      status: 500,
      code: "internal",
      message: "start failed",
    });
  });

  it("getActiveScan: 204はnullを返す", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error("no body")),
    } as Response);
    await expect(scanEntityApi.getActiveScan()).resolves.toBeNull();
  });

  it("getScanRecord: 未スキャンの空の記録を返す", async () => {
    const empty = { finishedAt: null, updatedWorks: [] };
    mockFetch.mockResolvedValue(makeResponse(empty));
    await expect(scanEntityApi.getScanRecord()).resolves.toEqual(empty);
    expect(mockFetch).toHaveBeenCalledWith("/api/scan/last");
  });

  it("getScanJob: 404はサーバーのcode/messageをApiRequestErrorとして保持する", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: { code: "not_found", message: "evicted" } }, 404),
    );
    await expect(scanEntityApi.getScanJob("job-1")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      message: "evicted",
    });
  });
});

describe("work api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("patchWorkSource PATCHes to /api/works/:id and returns snapshot", async () => {
    const snapshot = {
      sourceRevision: "rev-2",
      id: "work-1",
      physicalPath: "/library/work-1",
      title: "new title",
      tags: ["tag1", "tag2"],
      urls: [],
      coverImage: null,
      dlsite: emptyMetaDlsiteState(),
    };
    mockFetch.mockResolvedValue(makeResponse({ snapshot, projection: { status: "published" } }));
    const result = await workApi.patchWorkSource("work-1", {
      sourceRevision: "rev-1",
      title: "new title",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/works/work-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ sourceRevision: "rev-1", title: "new title" }),
      }),
    );
    expect(result).toEqual({ snapshot, projection: { status: "published" } });
  });

  it("patchWorkBookmark PATCHes /api/works/:id/bookmark", async () => {
    mockFetch.mockResolvedValue(makeResponse({ bookmarked: true }));
    const result = await workApi.patchWorkBookmark("work-1", { bookmarked: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/works/work-1/bookmark",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ bookmarked: true }),
      }),
    );
    expect(result).toEqual({ bookmarked: true });
  });

  it("addWorkTag PUTs encoded tag path", async () => {
    const snapshot = {
      sourceRevision: "rev-2",
      id: "work-1",
      physicalPath: "/library/work-1",
      title: "テスト作品",
      tags: ["a/b"],
      urls: [],
      coverImage: null,
      dlsite: emptyMetaDlsiteState(),
    };
    mockFetch.mockResolvedValue(makeResponse({ snapshot, projection: { status: "published" } }));
    await workApi.addWorkTag("work-1", "a/b");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/works/work-1/tags/a%2Fb",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("saveResumePosition POSTs to /api/works/:id/resume", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(undefined),
    } as Response);
    const resume = {
      playlistId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      trackId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      offsetSec: 42.5,
    };
    await workApi.saveResumePosition("work-1", resume);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/works/work-1/resume",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(resume),
      }),
    );
  });

  it("saveResumePosition: 204以外の成功レスポンスは契約違反になる", async () => {
    mockFetch.mockResolvedValue(makeResponse({ saved: true }));
    await expect(
      workApi.saveResumePosition("work-1", {
        playlistId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        trackId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        offsetSec: 42.5,
      }),
    ).rejects.toThrow(/POST \/works\/work-1\/resume/);
  });

  it("fetchDlsiteInfo POSTs to /api/dlsite/:workId/fetch with force", async () => {
    const mockInfo = {
      rjCode: "RJ123456",
      title: "test",
      circle: null,
      cvs: [],
      genreTags: [],
      ageRating: null,
      coverUrl: null,
      url: "",
    };
    const preview = {
      info: mockInfo,
      infoRevision: "1700000000000:1",
      cachedCover: null,
      sourceRevision: "revision-1",
    };
    mockFetch.mockResolvedValue(makeResponse(preview));
    const result = await workApi.fetchDlsiteInfo("work-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/dlsite/work-1/fetch?force=true",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(preview);
  });

  it("getCoverImageUrl returns the media/cover URL", () => {
    expect(workApi.getCoverImageUrl("RJ001001", "abc123")).toBe(
      "/api/media/cover/RJ001001?v=abc123",
    );
    expect(workApi.getCoverImageUrl("RJ001001", "abc123", 256)).toBe(
      "/api/media/cover/RJ001001?v=abc123&w=256",
    );
  });

  it("getAudioUrl returns the media/audio URL", () => {
    expect(workApi.getAudioUrl("RJ001001", "track01.mp3")).toBe(
      "/api/media/audio/RJ001001/track01.mp3",
    );
  });
});

describe("library api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("getAllWorks は「すべて」の作品一覧を既定の並びで取り、WorksPage を返す", async () => {
    const mockPage = {
      items: [makeWorkListItem({ id: "work-1" })],
      total: 42,
      stats: { trackCount: 0, durationSec: 0 },
    };
    mockFetch.mockResolvedValue(makeResponse(mockPage));
    const result = await smartFolderApi.getAllWorks({ limit: 1 });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/smart-folders/all/works?sort=added-desc&page=1&limit=1",
    );
    expect(result).toEqual(mockPage);
  });

  it("getAllWorks は scanRecord と scanChange をクエリへ載せ、idsは送らない", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ items: [], total: 0, stats: { trackCount: 0, durationSec: 0 } }),
    );
    await smartFolderApi.getAllWorks({ scanRecord: "updated", scanChange: "moved", limit: 200 });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/smart-folders/all/works?sort=added-desc&page=1&limit=200&scanRecord=updated&scanChange=moved",
    );
  });

  it("listSmartFolders fetches /api/smart-folders", async () => {
    mockFetch.mockResolvedValue(makeResponse([]));
    await smartFolderApi.listSmartFolders();
    expect(mockFetch).toHaveBeenCalledWith("/api/smart-folders");
  });

  it("getSmartFolderWorks は解決済みの sort・ページを送り、空の q・tags・group・seed は含めない", async () => {
    const mockPage = {
      items: [makeWorkListItem({ id: "work-1" })],
      total: 1,
      stats: { trackCount: 0, durationSec: 0 },
    };
    mockFetch.mockResolvedValue(makeResponse(mockPage));
    const result = await smartFolderApi.getSmartFolderWorks("sf-1", {
      q: "",
      tags: [],
      group: null,
      sort: "added-desc",
      seed: 7,
      page: 1,
      limit: 200,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/smart-folders/sf-1/works?sort=added-desc&page=1&limit=200",
    );
    expect(result).toEqual(mockPage);
  });

  it("getSmartFolderWorks は tags・q・group を渡し、チップのつなぎ方は送らない。擬似タグも tags に含まれる", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ items: [], total: 0, stats: { trackCount: 0, durationSec: 0 } }),
    );
    await smartFolderApi.getSmartFolderWorks("by-cv", {
      q: "雨",
      tags: ["cv/藤田茜", "ASMR", "@year/2024"],
      group: "霧島レイ",
      sort: "title-asc",
      seed: undefined,
      page: 2,
      limit: 200,
    });
    const url = new URL(String(mockFetch.mock.calls.at(-1)![0]), "http://localhost");
    expect(url.pathname).toBe("/api/smart-folders/by-cv/works");
    expect(url.searchParams.get("q")).toBe("雨");
    expect(url.searchParams.getAll("tags")).toEqual(["cv/藤田茜", "ASMR", "@year/2024"]);
    expect(url.searchParams.get("group")).toBe("霧島レイ");
    expect(url.searchParams.get("sort")).toBe("title-asc");
    expect(url.searchParams.has("tagMode")).toBe(false);
    expect(url.searchParams.get("page")).toBe("2");
  });

  it("getSmartFolderWorks は sort=random のときだけ seed を送る", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ items: [], total: 0, stats: { trackCount: 0, durationSec: 0 } }),
    );
    const base = { q: "", tags: [], group: null, page: 1, limit: 200 };
    await smartFolderApi.getSmartFolderWorks("random", { ...base, sort: "random", seed: 42 });
    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/smart-folders/random/works?sort=random&seed=42&page=1&limit=200",
    );
  });

  it("getSmartFolderGroups は groupBy だけを body に POST する（自身の値一覧）", async () => {
    mockFetch.mockResolvedValue(makeResponse([]));
    await smartFolderApi.getSmartFolderGroups("by-cv", {
      groupBy: { kind: "prefix", prefix: "cv" },
    });
    const [url, init] = mockFetch.mock.calls.at(-1)!;
    expect(url).toBe("/api/smart-folders/by-cv/groups");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ groupBy: { kind: "prefix", prefix: "cv" } });
  });

  it("getSmartFolderGroups は候補用に group・tags・q も body へ渡す", async () => {
    mockFetch.mockResolvedValue(makeResponse([]));
    await smartFolderApi.getSmartFolderGroups("all", {
      groupBy: { kind: "tag" },
      group: "x",
      tags: ["ASMR"],
      q: "雨",
    });
    const [, init] = mockFetch.mock.calls.at(-1)!;
    expect(JSON.parse(String(init?.body))).toEqual({
      groupBy: { kind: "tag" },
      group: "x",
      tags: ["ASMR"],
      q: "雨",
    });
  });

  it("updateSmartFolder は PUT /api/smart-folders/:id へ保存内容を送る", async () => {
    const item = {
      id: "sf-1",
      name: "お気に入り",
      condition: { type: "and", children: [] },
      sort: "title-asc",
      groupBy: null,
      position: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      count: null,
    };
    mockFetch.mockResolvedValue(makeResponse(item));
    const write = {
      name: "お気に入り",
      condition: { type: "and" as const, children: [] },
      sort: "title-asc" as const,
      groupBy: null,
    };
    const result = await smartFolderApi.updateSmartFolder("sf-1", write);
    const [url, init] = mockFetch.mock.calls.at(-1)!;
    expect(url).toBe("/api/smart-folders/sf-1");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual(write);
    expect(result.sort).toBe("title-asc");
  });

  it("exportLibrary POSTs to /api/export and returns parsed response", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({
        data: '{"version":1}',
        dataIntegrityWarning: { skippedCount: 1, skippedWorkIds: ["w-1"] },
      }),
    );
    const result = await libraryApi.exportLibrary();
    expect(result.data).toBe('{"version":1}');
    expect(result.dataIntegrityWarning).toEqual({ skippedCount: 1, skippedWorkIds: ["w-1"] });
  });
});

describe("候補の追加の分割送信", () => {
  const APPLY = { title: true, cover: true, tags: false, url: true };
  const pathsOf = (count: number) => Array.from({ length: count }, (_, i) => `候補${i}`);

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("1000件を上限ごとに分けて順に送り、全件を追加済みとして返す", async () => {
    const requestSizes: number[] = [];
    mockFetch.mockImplementation(async (_url, init) => {
      const body = scanCandidatesRegisterRequestSchema.parse(JSON.parse(String(init?.body)));
      requestSizes.push(body.paths.length);
      expect(body.apply).toEqual(APPLY);
      return makeResponse(
        {
          registered: body.paths.map((path) => ({ path, workId: `w-${path}`, coverSkipped: null })),
          failures: [],
        },
        201,
      );
    });

    const outcome = await workApi.registerScanCandidates(pathsOf(1000), APPLY);

    expect(requestSizes).toHaveLength(Math.ceil(1000 / SCAN_CANDIDATE_REGISTER_MAX_PATHS));
    expect(Math.max(...requestSizes)).toBeLessThanOrEqual(SCAN_CANDIDATE_REGISTER_MAX_PATHS);
    expect(outcome.registered).toHaveLength(1000);
    expect(outcome.failures).toEqual([]);
    expect(outcome.interruptedBy).toBeNull();
  });

  it("途中の分割が409で失敗したらそこで止め、それまでに追加できた分を返す", async () => {
    let calls = 0;
    mockFetch.mockImplementation(async (_url, init) => {
      calls += 1;
      if (calls === 3) {
        return makeResponse({ error: { code: "conflict", message: "候補が更新されました" } }, 409);
      }
      const body = scanCandidatesRegisterRequestSchema.parse(JSON.parse(String(init?.body)));
      return makeResponse(
        {
          registered: body.paths.map((path) => ({ path, workId: `w-${path}`, coverSkipped: null })),
          failures: [],
        },
        201,
      );
    });

    const outcome = await workApi.registerScanCandidates(pathsOf(100), APPLY);

    expect(calls).toBe(3);
    expect(outcome.registered).toHaveLength(2 * SCAN_CANDIDATE_REGISTER_MAX_PATHS);
    expect(outcome.interruptedBy).toMatchObject({ status: 409 });
  });
});

describe("error handling", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("throws an Error containing the apiErrorSchema message on failure", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: { code: "not_found", message: "作品が見つかりません: work-1" } }, 404),
    );
    await expect(workApi.getWork("work-1")).rejects.toThrow(/作品が見つかりません: work-1/);
  });
});

describe("レスポンス検証（getParsed等）", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("getWork: 200かつ契約に適合するレスポンスはWorkとして解決する", async () => {
    const mockWork = makeWork({ id: "work-1" });
    mockFetch.mockResolvedValue(makeResponse(mockWork));
    const result = await workApi.getWork("work-1");
    expect(result).toEqual(mockWork);
  });

  it("getWork: 404はnullへフォールバックせずApiRequestErrorとして伝播する", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: { code: "not_found", message: "作品が見つかりません: work-1" } }, 404),
    );
    await expect(workApi.getWork("work-1")).rejects.toThrow(/作品が見つかりません: work-1/);
  });

  it("getWork: 200だが契約に適合しないレスポンスは握りつぶさずエンドポイント名を含むエラーを投げる", async () => {
    mockFetch.mockResolvedValue(makeResponse({ id: "work-1" }));
    await expect(workApi.getWork("work-1")).rejects.toThrow(/GET \/works\/work-1/);
  });

  it("prepareWorkPlayback: 200かつ契約に適合するレスポンスはWorkとして解決する", async () => {
    const mockWork = makeWork({ id: "work-1" });
    mockFetch.mockResolvedValue(makeResponse(mockWork));
    const result = await workApi.prepareWorkPlayback("work-1");
    expect(result).toEqual(mockWork);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/works/work-1/playback-preparation",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("prepareWorkPlayback: 404はnullへフォールバックせずApiRequestErrorとして伝播する", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: { code: "not_found", message: "作品が見つかりません: work-1" } }, 404),
    );
    await expect(workApi.prepareWorkPlayback("work-1")).rejects.toThrow(
      /作品が見つかりません: work-1/,
    );
  });

  it("getAllWorks: 契約に適合しないitemsは検証エラーになる", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({
        items: [{ id: "work-1" }],
        total: 1,
        stats: { trackCount: 0, durationSec: 0 },
      }),
    );
    await expect(smartFolderApi.getAllWorks({ limit: 1 })).rejects.toThrow(
      /GET \/smart-folders\/all\/works/,
    );
  });

  it("getAllWorks: statsが欠落したレスポンスは検証エラーになる", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ items: [makeWorkListItem({ id: "work-1" })], total: 1 }),
    );
    await expect(smartFolderApi.getAllWorks({ limit: 1 })).rejects.toThrow(
      /GET \/smart-folders\/all\/works/,
    );
  });

  it("getSettings: 契約に適合しない設定は検証エラーになる", async () => {
    mockFetch.mockResolvedValue(makeResponse({ rootFolder: 42, lastScanTime: null }));
    await expect(settingsApi.getSettings()).rejects.toThrow(/GET \/settings/);
  });

  it("startScan: 契約に適合しないジョブは検証エラーになる", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({
        job: { id: 1 },
      }),
    );
    await expect(scanEntityApi.startScan()).rejects.toThrow(/POST \/scan/);
  });

  it("browseFs: 契約に適合しない一覧は検証エラーになる", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ path: "/library", parent: null, workId: null, entries: [{ name: "x" }] }),
    );
    await expect(filesApi.browseFs()).rejects.toThrow(/GET \/fs/);
  });
});
