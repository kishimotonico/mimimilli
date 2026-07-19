import { describe, it, expect, vi, beforeEach } from "vitest";
import * as workApi from "../../src/entities/work/api";
import * as filesApi from "../../src/features/files/api";
import * as libraryApi from "../../src/features/library/api";
import * as settingsApi from "../../src/features/settings/api";
import * as scanApi from "../../src/features/scan/api";
import { emptyDlsiteState, type Work, type WorkSummary } from "@mimimilli/shared";

const mockFetch = vi.mocked(fetch);

function makeResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

/** workSchema/workSummarySchema に適合する最小のfixtureを作る（レスポンス検証テスト用） */
function makeWorkSummary(overrides: Partial<WorkSummary> = {}): WorkSummary {
  return {
    id: "work-1",
    title: "テスト作品",
    coverImage: null,
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

function makeWork(overrides: Partial<Work> = {}): Work {
  const { trackCount: _trackCount, ...summary } = makeWorkSummary();
  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  return {
    ...summary,
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

  it("getRootFolder fetches /api/settings and returns rootFolder", async () => {
    mockFetch.mockResolvedValue(makeResponse({ rootFolder: "/test/path", lastScanTime: null }));
    const result = await settingsApi.getRootFolder();
    expect(mockFetch).toHaveBeenCalledWith("/api/settings");
    expect(result).toBe("/test/path");
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

  it("scanLibrary POSTs to /api/scan", async () => {
    const mockResult = {
      registered: 5,
      newlyGenerated: 2,
      errors: 0,
      missing: 0,
      newWorkIds: [],
      rjCodeMissingCount: 0,
    };
    mockFetch.mockResolvedValue(makeResponse(mockResult));
    const result = await scanApi.scanLibrary();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/scan",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(mockResult);
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
    mockFetch.mockResolvedValue(makeResponse(mockInfo));
    const result = await workApi.fetchDlsiteInfo("work-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/dlsite/work-1/fetch",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(mockInfo);
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

  it("getFileUrl returns the media/file URL and encodes nested segments", () => {
    expect(workApi.getFileUrl("RJ001001", "cover.jpg")).toBe("/api/media/file/RJ001001/cover.jpg");
    expect(workApi.getFileUrl("RJ001001", "特典/台本.pdf")).toBe(
      `/api/media/file/RJ001001/${encodeURIComponent("特典")}/${encodeURIComponent("台本.pdf")}`,
    );
  });

  it("getAllWorks fetches /api/works and returns items", async () => {
    const mockPage = {
      items: [makeWorkSummary({ id: "work-1" }), makeWorkSummary({ id: "work-2" })],
      total: 2,
    };
    mockFetch.mockResolvedValue(makeResponse(mockPage));
    const result = await workApi.getAllWorks();
    expect(mockFetch).toHaveBeenCalledWith("/api/works");
    expect(result).toEqual(mockPage.items);
  });
});

describe("library api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("searchWorks fetches /api/works and returns the WorksPage envelope", async () => {
    const mockPage = { items: [makeWorkSummary({ id: "work-1" })], total: 1 };
    mockFetch.mockResolvedValue(makeResponse(mockPage));
    const result = await libraryApi.searchWorks({ q: "test", tags: ["tag,one", "tag2"] });
    expect(mockFetch).toHaveBeenCalledWith("/api/works?q=test&tags=tag%2Cone&tags=tag2");
    expect(result).toEqual(mockPage);
  });

  it("searchWorks supports limit/page for the library total count", async () => {
    const mockPage = { items: [makeWorkSummary({ id: "work-1" })], total: 42 };
    mockFetch.mockResolvedValue(makeResponse(mockPage));
    const result = await libraryApi.searchWorks({ limit: 1 });
    expect(mockFetch).toHaveBeenCalledWith("/api/works?limit=1");
    expect(result.total).toBe(42);
  });

  it("randomのレスポンスseedを次ページへ送り、ページ間の重複・欠落を防げる", async () => {
    const seed = 2468;
    mockFetch
      .mockResolvedValueOnce(
        makeResponse({
          items: [makeWorkSummary({ id: "work-1" }), makeWorkSummary({ id: "work-3" })],
          total: 4,
          seed,
        }),
      )
      .mockResolvedValueOnce(
        makeResponse({
          items: [makeWorkSummary({ id: "work-4" }), makeWorkSummary({ id: "work-2" })],
          total: 4,
          seed,
        }),
      );

    const first = await libraryApi.searchWorks({ sort: "random", page: 1, limit: 2 });
    const second = await libraryApi.searchWorks({
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
    const mockFacets = [{ value: "cv/水瀬なずな", count: 3 }];
    mockFetch.mockResolvedValue(makeResponse(mockFacets));
    const result = await libraryApi.getAxisFacets("cv");
    expect(mockFetch).toHaveBeenCalledWith("/api/axes/cv");
    expect(result).toEqual(mockFacets);
  });

  it("listSmartFolders fetches /api/smart-folders", async () => {
    mockFetch.mockResolvedValue(makeResponse([]));
    await libraryApi.listSmartFolders();
    expect(mockFetch).toHaveBeenCalledWith("/api/smart-folders");
  });

  it("evalSmartFolder fetches /api/smart-folders/:id/works", async () => {
    mockFetch.mockResolvedValue(makeResponse([]));
    await libraryApi.evalSmartFolder("sf-1");
    expect(mockFetch).toHaveBeenCalledWith("/api/smart-folders/sf-1/works");
  });

  it("exportLibrary POSTs to /api/export and returns data string", async () => {
    mockFetch.mockResolvedValue(makeResponse({ data: '{"version":1}' }));
    const result = await libraryApi.exportLibrary();
    expect(result).toBe('{"version":1}');
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
    mockFetch.mockResolvedValue(makeResponse({ items: [{ id: "work-1" }], total: 1 }));
    await expect(libraryApi.searchWorks({})).rejects.toThrow(/GET \/works/);
  });

  it("getSettings: 契約に適合しない設定は検証エラーになる", async () => {
    mockFetch.mockResolvedValue(makeResponse({ rootFolder: 42, lastScanTime: null }));
    await expect(settingsApi.getSettings()).rejects.toThrow(/GET \/settings/);
  });

  it("scanLibrary: 契約に適合しないスキャン結果は検証エラーになる", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({
        registered: -1,
        newlyGenerated: 0,
        errors: 0,
        missing: 0,
        newWorkIds: [],
        rjCodeMissingCount: 0,
      }),
    );
    await expect(scanApi.scanLibrary()).rejects.toThrow(/POST \/scan/);
  });

  it("browseFs: 契約に適合しない一覧は検証エラーになる", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ path: "/library", parent: null, workId: null, entries: [{ name: "x" }] }),
    );
    await expect(filesApi.browseFs()).rejects.toThrow(/GET \/fs/);
  });
});
