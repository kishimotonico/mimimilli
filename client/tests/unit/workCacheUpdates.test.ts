import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiError, mockApi } from "../helpers/api";
import { buildScanCandidate, buildScanDiagnostics } from "../helpers/builders";
import { SCAN_CANDIDATES_QUERY_KEY } from "../../src/entities/scan/scanCandidatesCache";
import { QueryClient, QueryObserver, type QueryKey } from "@tanstack/react-query";
import {
  emptyDlsiteState,
  type Work,
  type WorkEditSnapshot,
  type WorkSourceMutationResult,
} from "@mimimilli/shared";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../../src/entities/tag/queryKeys";
import { FILE_SYSTEM_QUERY_KEYS } from "../../src/entities/file-system/queryKeys";
import { SCAN_QUERY_KEYS } from "../../src/entities/scan/queryKeys";
import {
  updateCachesAfterBookmark,
  updateCachesAfterDlsiteLinkageChange,
  updateCachesAfterDlsiteFetch,
  updateCachesAfterDlsiteSyncFetch,
  updateCachesAfterIdentityReassign,
  updateCachesAfterLibraryScan,
  updateCachesAfterMissingUnregistration,
  updateCachesAfterPlaybackPrepared,
  updateCachesAfterRegistration,
  updateCachesAfterSourceEdit,
  updateCachesAfterUnregistration,
} from "../../src/entities/work/model/workCacheUpdates";

beforeEach(() => {
  mockApi({ "GET /api/scan/candidates": { scanCompleted: true, candidates: [] } });
});

const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: "w1",
    title: "作品",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/lib/w1",
    totalDurationSec: 120,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [],
    resume: null,
    ...overrides,
  };
}

function makeSnapshot(id: string, title = "新タイトル"): WorkEditSnapshot {
  return {
    sourceRevision: "rev-2",
    id,
    physicalPath: `/lib/${id}`,
    title,
    tags: [],
    urls: [],
    coverImage: null,
    dlsite: { rjCode: null, status: "none", appliedTags: [] },
  };
}

function mutationResult(id: string): WorkSourceMutationResult {
  return { snapshot: makeSnapshot(id), projection: { status: "published" } };
}

const emptyPages = { pages: [{ items: [], total: 0 }], pageParams: [{ page: 1 }] };

const KEYS = {
  detail1: WORK_QUERY_KEYS.detail("w1"),
  source1: WORK_QUERY_KEYS.source("w1"),
  detail2: WORK_QUERY_KEYS.detail("w2"),
  source2: WORK_QUERY_KEYS.source("w2"),
  list: WORK_QUERY_KEYS.list({ sort: "added-desc" }),
  otherList: WORK_QUERY_KEYS.list({ sort: "title-asc" }),
  total: WORK_QUERY_KEYS.total(),
  groupValues: SMART_FOLDER_QUERY_KEYS.groups("sf-1", "prefix:cv"),
  tags: TAG_QUERY_KEYS.all(),
  smartWorks: SMART_FOLDER_QUERY_KEYS.works("sf-1"),
  smartFolders: SMART_FOLDER_QUERY_KEYS.all(),
  smartFolderCounts: SMART_FOLDER_QUERY_KEYS.counts(),
  fs: FILE_SYSTEM_QUERY_KEYS.directory("dlsite"),
  diagnostics: SCAN_QUERY_KEYS.diagnostics(),
  scanRecord: SCAN_QUERY_KEYS.last(),
  candidates: SCAN_QUERY_KEYS.candidates(),
} satisfies Record<string, QueryKey>;

type KeyName = keyof typeof KEYS;

function seededClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(KEYS.detail1, makeWork());
  queryClient.setQueryData(KEYS.source1, makeSnapshot("w1", "作品"));
  queryClient.setQueryData(KEYS.detail2, makeWork({ id: "w2" }));
  queryClient.setQueryData(KEYS.source2, makeSnapshot("w2", "作品2"));
  queryClient.setQueryData(KEYS.list, structuredClone(emptyPages));
  queryClient.setQueryData(KEYS.otherList, structuredClone(emptyPages));
  queryClient.setQueryData(KEYS.total, { items: [], total: 0 });
  queryClient.setQueryData(KEYS.groupValues, []);
  queryClient.setQueryData(KEYS.tags, []);
  queryClient.setQueryData(KEYS.smartWorks, structuredClone(emptyPages));
  queryClient.setQueryData(KEYS.smartFolders, []);
  queryClient.setQueryData(KEYS.smartFolderCounts, {});
  queryClient.setQueryData(KEYS.fs, { entries: [] });
  queryClient.setQueryData(KEYS.diagnostics, buildScanDiagnostics());
  queryClient.setQueryData(KEYS.scanRecord, { finishedAt: null });
  queryClient.setQueryData(KEYS.candidates, []);
  return queryClient;
}

function invalidatedKeys(queryClient: QueryClient): KeyName[] {
  return (Object.keys(KEYS) as KeyName[]).filter(
    (name) => queryClient.getQueryState(KEYS[name])?.isInvalidated === true,
  );
}

function removedKeys(queryClient: QueryClient): KeyName[] {
  return (Object.keys(KEYS) as KeyName[]).filter(
    (name) => queryClient.getQueryState(KEYS[name]) === undefined,
  );
}

const LIBRARY_VIEWS: KeyName[] = [
  "list",
  "otherList",
  "total",
  "groupValues",
  "tags",
  "smartWorks",
  "smartFolderCounts",
];
const REGISTRATION_VIEWS: KeyName[] = [...LIBRARY_VIEWS, "fs", "diagnostics", "scanRecord"];

function sorted(names: KeyName[]): KeyName[] {
  return [...names].sort();
}

describe("meta 編集の必須更新", () => {
  it("source へ応答の snapshot を書き戻し、詳細・一覧系・グループの値・タグ・SF を無効化する", async () => {
    const queryClient = seededClient();

    await updateCachesAfterSourceEdit(queryClient, mutationResult("w1"));

    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted(["detail1", ...LIBRARY_VIEWS, "diagnostics"]),
    );
    expect(queryClient.getQueryData(KEYS.source1)).toEqual(makeSnapshot("w1"));
  });
});

describe("再生開始時の投影反映", () => {
  it("詳細へ応答の Work を書き戻し、詳細自体は無効化しない", async () => {
    const queryClient = seededClient();
    const prepared = makeWork({ title: "投影後" });

    await updateCachesAfterPlaybackPrepared(queryClient, prepared);

    expect(queryClient.getQueryData(KEYS.detail1)).toEqual(prepared);
    // 件数だけを取り直し、定義の一覧と開いている一覧の並びは動かさない（ADR-0040）
    expect(invalidatedKeys(queryClient)).toEqual(["smartFolderCounts"]);
  });
});

describe("bookmark の必須更新", () => {
  it("詳細の bookmarked だけを書き換え、resume は触らない", async () => {
    const queryClient = seededClient();
    const resume = { playlistId, trackId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", offsetSec: 12 };
    queryClient.setQueryData(KEYS.detail1, makeWork({ resume }));

    await updateCachesAfterBookmark(queryClient, { workId: "w1", bookmarked: true });

    expect(queryClient.getQueryData<Work>(KEYS.detail1)).toMatchObject({
      bookmarked: true,
      resume,
      title: "作品",
    });
  });

  it("一覧（works の list 形と smartFolderWorks）・グループの値・スマートフォルダーの件数だけを無効化し、総件数・詳細は無効化しない", async () => {
    const queryClient = seededClient();

    await updateCachesAfterBookmark(queryClient, { workId: "w1", bookmarked: true });

    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted(["list", "otherList", "smartWorks", "groupValues", "smartFolderCounts"]),
    );
  });

  it("画面が引き受けた一覧は無効化せず、observer のない他の一覧は再取得せず stale にする", async () => {
    const queryClient = seededClient();
    let fetchCount = 0;
    const observer = new QueryObserver(queryClient, {
      queryKey: KEYS.list,
      queryFn: () => {
        fetchCount += 1;
        return Promise.resolve(emptyPages);
      },
    });
    const unsubscribe = observer.subscribe(() => {});

    await updateCachesAfterBookmark(queryClient, { workId: "w1", bookmarked: true }, KEYS.list);
    unsubscribe();

    expect(queryClient.getQueryCache().find({ queryKey: KEYS.list })?.isStale()).toBe(false);
    expect(queryClient.getQueryCache().find({ queryKey: KEYS.otherList })?.isStale()).toBe(true);
    expect(queryClient.getQueryCache().find({ queryKey: KEYS.smartWorks })?.isStale()).toBe(true);
    expect(fetchCount).toBe(0);
  });
});

describe("初回の取得の途中で作品が変わったとき", () => {
  it("件数は進行中の古い応答でなく、変更後の値で取り直される", async () => {
    const queryClient = new QueryClient();
    let served = 0;
    const resolvers: Array<(counts: Record<string, number>) => void> = [];
    const observer = new QueryObserver(queryClient, {
      queryKey: SMART_FOLDER_QUERY_KEYS.counts(),
      queryFn: () =>
        new Promise<Record<string, number>>((resolve) => {
          served += 1;
          resolvers.push(resolve);
        }),
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(resolvers).toHaveLength(1));

    const updating = updateCachesAfterBookmark(queryClient, { workId: "w1", bookmarked: true });
    resolvers[0]!({ fav: 0 });
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));
    resolvers[1]!({ fav: 1 });
    await updating;
    unsubscribe();

    expect(served).toBe(2);
    expect(queryClient.getQueryData(SMART_FOLDER_QUERY_KEYS.counts())).toEqual({ fav: 1 });
  });
});

describe("登録・スキャン完了の必須更新", () => {
  it("登録は登録の集合に加えて全詳細を無効化する（再登録で古い詳細・sourceRevision を残さない）", async () => {
    const queryClient = seededClient();

    await updateCachesAfterRegistration(queryClient);

    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted([...REGISTRATION_VIEWS, "detail1", "source1", "detail2", "source2"]),
    );
  });

  it("登録・解除は、サーバーの応答で候補一覧を置き換え、取得に失敗しても reject しない", async () => {
    const found = buildScanCandidate({ path: "戻った作品" });
    const api = mockApi({
      "GET /api/scan/candidates": { scanCompleted: true, candidates: [found] },
    });
    const queryClient = seededClient();

    await updateCachesAfterUnregistration(queryClient, "w1");
    expect(queryClient.getQueryData(KEYS.candidates)).toEqual({
      scanCompleted: true,
      candidates: [found],
    });

    queryClient.setQueryData(KEYS.candidates, []);
    await expect(updateCachesAfterRegistration(queryClient)).resolves.toEqual({
      scanCompleted: true,
      candidates: [found],
    });
    expect(queryClient.getQueryData(KEYS.candidates)).toEqual({
      scanCompleted: true,
      candidates: [found],
    });
    expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(2);

    mockApi({ "GET /api/scan/candidates": apiError(500, "internal") });
    await expect(updateCachesAfterRegistration(queryClient)).resolves.toBeNull();
  });

  it("スキャン完了は登録の集合に加えて全詳細を無効化する", async () => {
    const queryClient = seededClient();

    await updateCachesAfterLibraryScan(queryClient);

    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted([...REGISTRATION_VIEWS, "detail1", "source1", "detail2", "source2"]),
    );
  });
});

describe("登録解除の必須更新", () => {
  it("単体は登録の集合と解除した作品の詳細だけを無効化し、キャッシュは消さない（開いている詳細が404になり、補正が走る）", async () => {
    const queryClient = seededClient();

    await updateCachesAfterUnregistration(queryClient, "w1");

    expect(removedKeys(queryClient)).toEqual([]);
    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted([...REGISTRATION_VIEWS, "detail1"]),
    );
  });

  it("missing 一括は登録の集合と全詳細を無効化する（どの作品が消えたか応答に無い）", async () => {
    const queryClient = seededClient();

    await updateCachesAfterMissingUnregistration(queryClient);

    expect(removedKeys(queryClient)).toEqual([]);
    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted([...REGISTRATION_VIEWS, "detail1", "source1", "detail2", "source2"]),
    );
  });
});

describe("ID 再採番の必須更新", () => {
  it("新 id の source へ応答の snapshot を書き戻し、全詳細と登録の集合を無効化する", async () => {
    const queryClient = seededClient();
    const result = mutationResult("w-new");

    await updateCachesAfterIdentityReassign(queryClient, result);

    expect(queryClient.getQueryData(WORK_QUERY_KEYS.source("w-new"))).toEqual(result.snapshot);
    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted([...REGISTRATION_VIEWS, "detail1", "source1", "detail2", "source2"]),
    );
  });
});

describe("DLsite の必須更新", () => {
  it("単体適用は source を書き戻して残し、詳細・一覧系・グループの値・タグ・SF を無効化する", async () => {
    const queryClient = seededClient();

    await updateCachesAfterDlsiteLinkageChange(queryClient, mutationResult("w1"));

    expect(queryClient.getQueryData(KEYS.source1)).toEqual(makeSnapshot("w1"));
    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted(["detail1", ...LIBRARY_VIEWS, "diagnostics"]),
    );
  });

  it("情報の取得は同じRJコードの詳細と一覧系を無効化し、別コードの詳細と source は残す", async () => {
    const queryClient = seededClient();
    queryClient.setQueryData(
      KEYS.detail1,
      makeWork({ dlsite: { ...emptyDlsiteState(), rjCode: "RJ000001" } }),
    );
    queryClient.setQueryData(
      KEYS.detail2,
      makeWork({ id: "w2", dlsite: { ...emptyDlsiteState(), rjCode: "RJ000002" } }),
    );

    await updateCachesAfterDlsiteFetch(queryClient, ["rj000001"]);

    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted(["detail1", ...LIBRARY_VIEWS, "diagnostics"]),
    );
  });

  describe("DLsiteの同期取得", () => {
    it("同じRJコードの作品を無効化し、候補キャッシュに同じコードの候補が無ければ候補一覧は取り直さない", async () => {
      const api = mockApi({ "GET /api/scan/candidates": { scanCompleted: true, candidates: [] } });
      const queryClient = seededClient();
      queryClient.setQueryData(
        KEYS.detail1,
        makeWork({ dlsite: { ...emptyDlsiteState(), rjCode: "RJ000001" } }),
      );
      queryClient.setQueryData(SCAN_CANDIDATES_QUERY_KEY, {
        scanCompleted: true,
        candidates: [buildScanCandidate({ path: "a", rjCode: "RJ000002" })],
      });

      await updateCachesAfterDlsiteSyncFetch(queryClient, "RJ000001");

      expect(sorted(invalidatedKeys(queryClient))).toEqual(
        sorted(["detail1", ...LIBRARY_VIEWS, "diagnostics"]),
      );
      expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(0);
    });

    it("キャッシュ済みの候補一覧に同じRJコードの候補があるときだけ、候補一覧を取り直す", async () => {
      const api = mockApi({ "GET /api/scan/candidates": { scanCompleted: true, candidates: [] } });
      const queryClient = seededClient();
      queryClient.setQueryData(SCAN_CANDIDATES_QUERY_KEY, {
        scanCompleted: true,
        candidates: [buildScanCandidate({ path: "a", rjCode: "rj000001" })],
      });

      await updateCachesAfterDlsiteSyncFetch(queryClient, "RJ000001");

      expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(1);
    });
  });
});
