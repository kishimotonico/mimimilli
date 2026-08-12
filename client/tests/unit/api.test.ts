import { describe, it, expect, vi, beforeEach } from "vitest";
import * as workApi from "../../src/entities/work/api";
import * as smartFolderApi from "../../src/entities/smart-folder/api";
import * as filesApi from "../../src/features/files/api";
import * as libraryApi from "../../src/features/library/api";
import * as settingsApi from "../../src/features/settings/api";
import * as scanApi from "../../src/features/scan/api";
import {
  emptyDlsiteState,
  coverFieldsFromCover,
  type Work,
  type WorkListItem,
  type WorkSummary,
} from "@mimimilli/shared";

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
    mockFetch.mockResolvedValue(makeResponse({ rootFolder: "/test/path", lastScanTime: null }));
    const result = await settingsApi.getSettings();
    expect(mockFetch).toHaveBeenCalledWith("/api/settings");
    expect(result.rootFolder).toBe("/test/path");
  });

  it("setRootFolder PUTs to /api/settings", async () => {
    mockFetch.mockResolvedValue(makeResponse({ rootFolder: "/new/path", lastScanTime: null }));
    await settingsApi.setRootFolder("/new/path");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        method: "PUT",
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
        result: null,
        error: null,
      },
    };
    mockFetch.mockResolvedValue(makeResponse(mockResult, 202));
    const result = await scanApi.startScan();
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
        result: null,
        error: null,
      },
    };
    mockFetch.mockResolvedValue(makeResponse(mockResult, 202));
    await scanApi.startScan({ full: true });
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
      result: null,
      error: null,
    };
    mockFetch.mockResolvedValue(
      makeResponse({ error: { code: "conflict", message: "already active" }, active }, 409),
    );
    await expect(scanApi.startScan()).rejects.toMatchObject({
      status: 409,
      code: "conflict",
      active,
    });
  });

  it("startScan: 500はサーバーのcode/messageをApiRequestErrorとして保持する", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: { code: "internal", message: "start failed" } }, 500),
    );
    await expect(scanApi.startScan()).rejects.toMatchObject({
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
    await expect(scanApi.getActiveScan()).resolves.toBeNull();
  });

  it("getLastScanResult: 204はnullを返す", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error("no body")),
    } as Response);
    await expect(scanApi.getLastScanResult()).resolves.toBeNull();
  });

  it("getScanJob: 404はサーバーのcode/messageをApiRequestErrorとして保持する", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: { code: "not_found", message: "evicted" } }, 404),
    );
    await expect(scanApi.getScanJob("job-1")).rejects.toMatchObject({
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

  it("patchWork PATCHes to /api/works/:id with the given fields", async () => {
    const mockWork = makeWork({ title: "new title", tags: ["tag1", "tag2"], bookmarked: true });
    mockFetch.mockResolvedValue(makeResponse(mockWork));
    const result = await workApi.patchWork("work-1", {
      title: "new title",
      tags: ["tag1", "tag2"],
      bookmarked: true,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/works/work-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "new title", tags: ["tag1", "tag2"], bookmarked: true }),
      }),
    );
    expect(result).toEqual(mockWork);
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

  it("fetchDlsiteInfo POSTs to /api/dlsite/:workId/fetch", async () => {
    const mockInfo = {
      rjCode: "RJ123456",
      title: "test",
      circle: null,
      cvs: [],
      genreTags: [],
      coverUrl: null,
      url: "",
    };
    const preview = { info: mockInfo, sourceRevision: "revision-1" };
    mockFetch.mockResolvedValue(makeResponse(preview));
    const result = await workApi.fetchDlsiteInfo("work-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/dlsite/work-1/fetch",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(preview);
  });

  it("startDlsiteBulk: ジョブ開始レスポンスを検証する", async () => {
    mockFetch.mockResolvedValue(makeResponse({ started: false }, 202));
    await expect(workApi.startDlsiteBulk()).rejects.toThrow(/POST \/dlsite\/bulk/);
  });

  it("getCoverImageUrl returns the media/cover URL", () => {
    expect(workApi.getCoverImageUrl("RJ001001")).toBe("/api/media/cover/RJ001001");
    expect(workApi.getCoverImageUrl("RJ001001", 256)).toBe("/api/media/cover/RJ001001?w=256");
  });

  it("getAudioUrl returns the media/audio URL", () => {
    expect(workApi.getAudioUrl("RJ001001", "track01.mp3")).toBe(
      "/api/media/audio/RJ001001/track01.mp3",
    );
  });

  it("getDlsiteNotificationSummary fetches the dedicated endpoint", async () => {
    const summary = {
      rjCodeMissingCount: 2,
      fetchFailedCount: 1,
      parseErrorCount: 0,
      parseErrorAlert: false,
      unlinkedCount: 3,
    };
    mockFetch.mockResolvedValue(makeResponse(summary));
    await expect(workApi.getDlsiteNotificationSummary()).resolves.toEqual(summary);
    expect(mockFetch).toHaveBeenCalledWith("/api/dlsite/notifications");
  });
});

describe("library api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("searchWorks fetches /api/works and returns the WorksPage envelope", async () => {
    const mockPage = {
      items: [makeWorkListItem({ id: "work-1" })],
      total: 1,
      stats: { trackCount: 0, durationSec: 0 },
    };
    mockFetch.mockResolvedValue(makeResponse(mockPage));
    const result = await workApi.searchWorks({ q: "test", tags: ["tag,one", "tag2"] });
    expect(mockFetch).toHaveBeenCalledWith("/api/works?q=test&tags=tag%2Cone&tags=tag2");
    expect(result).toEqual(mockPage);
  });

  it("searchWorks supports limit/page for the library total count", async () => {
    const mockPage = {
      items: [makeWorkListItem({ id: "work-1" })],
      total: 42,
      stats: { trackCount: 0, durationSec: 0 },
    };
    mockFetch.mockResolvedValue(makeResponse(mockPage));
    const result = await workApi.searchWorks({ limit: 1 });
    expect(mockFetch).toHaveBeenCalledWith("/api/works?limit=1");
    expect(result.total).toBe(42);
  });

  it("searchWorks: ids:[]はサーバーへリクエストせず0件を返す（core・realと同じ空集合セマンティクス）", async () => {
    const result = await workApi.searchWorks({ ids: [] });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [], total: 0, stats: { trackCount: 0, durationSec: 0 } });
  });

  it("searchWorks: ids:[]かつsort:randomでもリクエストせずseedを発行する", async () => {
    const result = await workApi.searchWorks({ ids: [], sort: "random", seed: 777 });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toEqual({
      items: [],
      total: 0,
      stats: { trackCount: 0, durationSec: 0 },
      seed: 777,
    });
  });

  it("randomのレスポンスseedを次ページへ送り、ページ間の重複・欠落を防げる", async () => {
    const seed = 2468;
    mockFetch
      .mockResolvedValueOnce(
        makeResponse({
          items: [makeWorkListItem({ id: "work-1" }), makeWorkListItem({ id: "work-3" })],
          total: 4,
          stats: { trackCount: 0, durationSec: 0 },
          seed,
        }),
      )
      .mockResolvedValueOnce(
        makeResponse({
          items: [makeWorkListItem({ id: "work-4" }), makeWorkListItem({ id: "work-2" })],
          total: 4,
          stats: { trackCount: 0, durationSec: 0 },
          seed,
        }),
      );

    const first = await workApi.searchWorks({ sort: "random", page: 1, limit: 2 });
    const second = await workApi.searchWorks({
      sort: "random",
      seed: first.seed,
      page: 2,
      limit: 2,
    });

    expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/works?sort=random&page=1&limit=2");
    expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/works?sort=random&seed=2468&page=2&limit=2");
    const ids = [...first.items, ...second.items].map((work) => work.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids.toSorted()).toEqual(["work-1", "work-2", "work-3", "work-4"]);
  });

  it("getAxisFacets fetches /api/axes/:axis", async () => {
    const mockFacets = [{ value: "cv/水瀬なずな", count: 3, durationSec: 1200, covers: [] }];
    mockFetch.mockResolvedValue(makeResponse(mockFacets));
    const result = await libraryApi.getAxisFacets("cv");
    expect(mockFetch).toHaveBeenCalledWith("/api/axes/cv");
    expect(result).toEqual(mockFacets);
  });

  it("getAxisFacets は自軸除外後のフィルタ（tags/tagOp）をクエリへ渡す。組み込み軸の擬似タグも tags に含まれる", async () => {
    mockFetch.mockResolvedValue(makeResponse([]));
    await libraryApi.getAxisFacets("cv", {
      tags: ["サークル/月白製作所", "@year/2024"],
      tagOp: "AND",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/axes/cv?tags=%E3%82%B5%E3%83%BC%E3%82%AF%E3%83%AB%2F%E6%9C%88%E7%99%BD%E8%A3%BD%E4%BD%9C%E6%89%80&tags=%40year%2F2024&tagOp=AND",
    );
  });

  it("getAxisFacets はフィルタ省略時クエリ無しでフェッチする", async () => {
    mockFetch.mockResolvedValue(makeResponse([]));
    await libraryApi.getAxisFacets("cv", {});
    expect(mockFetch).toHaveBeenCalledWith("/api/axes/cv");
  });

  it("listSmartFolders fetches /api/smart-folders", async () => {
    mockFetch.mockResolvedValue(makeResponse([]));
    await smartFolderApi.listSmartFolders();
    expect(mockFetch).toHaveBeenCalledWith("/api/smart-folders");
  });

  it("evalSmartFolder fetches /api/smart-folders/:id/works", async () => {
    const mockPage = {
      items: [makeWorkListItem({ id: "work-1" })],
      total: 1,
      stats: { trackCount: 0, durationSec: 0 },
    };
    mockFetch.mockResolvedValue(makeResponse(mockPage));
    const result = await smartFolderApi.evalSmartFolder("sf-1", { page: 1, limit: 200 });
    expect(mockFetch).toHaveBeenCalledWith("/api/smart-folders/sf-1/works?page=1&limit=200");
    expect(result).toEqual(mockPage);
  });

  it("evalSmartFolder は tags（保持中フィルタ）もクエリへ渡す。組み込み軸の擬似タグも tags に含まれる", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ items: [], total: 0, stats: { trackCount: 0, durationSec: 0 } }),
    );
    await smartFolderApi.evalSmartFolder("sf-1", {
      page: 1,
      limit: 200,
      tags: ["cv/藤田茜", "ASMR", "@year/2024"],
      tagOp: "AND",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/smart-folders/sf-1/works?tags=cv%2F%E8%97%A4%E7%94%B0%E8%8C%9C&tags=ASMR&tags=%40year%2F2024&tagOp=AND&page=1&limit=200",
    );
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

  it("searchWorks: 契約に適合しないitemsは検証エラーになる", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({
        items: [{ id: "work-1" }],
        total: 1,
        stats: { trackCount: 0, durationSec: 0 },
      }),
    );
    await expect(workApi.searchWorks({})).rejects.toThrow(/GET \/works/);
  });

  it("searchWorks: statsが欠落したレスポンスは検証エラーになる", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ items: [makeWorkListItem({ id: "work-1" })], total: 1 }),
    );
    await expect(workApi.searchWorks({})).rejects.toThrow(/GET \/works/);
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
    await expect(scanApi.startScan()).rejects.toThrow(/POST \/scan/);
  });

  it("browseFs: 契約に適合しない一覧は検証エラーになる", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ path: "/library", parent: null, workId: null, entries: [{ name: "x" }] }),
    );
    await expect(filesApi.browseFs()).rejects.toThrow(/GET \/fs/);
  });
});
