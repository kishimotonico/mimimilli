import { describe, it, expect, vi, beforeEach } from "vitest";
import * as workApi from "../../src/entities/work/api";
import * as libraryApi from "../../src/features/library/api";
import * as settingsApi from "../../src/features/settings/api";
import * as scanApi from "../../src/features/scan/api";

const mockFetch = vi.mocked(fetch);

function makeResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
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
    const mockResult = { registered: 5, newlyGenerated: 2, errors: 0, missing: 0, newWorkIds: [] };
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
    const mockWork = { id: "work-1", title: "new title", tags: ["tag1", "tag2"], bookmarked: true };
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
    await workApi.saveResumePosition("work-1", 42.5, 2);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/works/work-1/resume",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ position: 42.5, trackIndex: 2 }),
      }),
    );
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
    const mockPage = { items: [{ id: "work-1" }, { id: "work-2" }], total: 2 };
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
    const mockPage = { items: [{ id: "work-1" }], total: 1 };
    mockFetch.mockResolvedValue(makeResponse(mockPage));
    const result = await libraryApi.searchWorks({ q: "test", tags: ["tag1"] });
    expect(mockFetch).toHaveBeenCalledWith("/api/works?q=test&tags=tag1");
    expect(result).toEqual(mockPage);
  });

  it("searchWorks supports limit/page for the library total count", async () => {
    const mockPage = { items: [{ id: "work-1" }], total: 42 };
    mockFetch.mockResolvedValue(makeResponse(mockPage));
    const result = await libraryApi.searchWorks({ limit: 1 });
    expect(mockFetch).toHaveBeenCalledWith("/api/works?limit=1");
    expect(result.total).toBe(42);
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
