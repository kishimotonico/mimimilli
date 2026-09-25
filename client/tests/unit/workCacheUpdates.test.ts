import { describe, expect, it } from "vitest";
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
  updateCachesAfterDlsiteBulkApply,
  updateCachesAfterDlsiteBulkFetch,
  updateCachesAfterDlsiteLinkageChange,
  updateCachesAfterDlsitePreviewFetch,
  updateCachesAfterIdentityReassign,
  updateCachesAfterLibraryScan,
  updateCachesAfterMissingUnregistration,
  updateCachesAfterPlaybackPrepared,
  updateCachesAfterRegistration,
  updateCachesAfterSourceEdit,
  updateCachesAfterUnregistration,
} from "../../src/entities/work/model/workCacheUpdates";

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
  favList: WORK_QUERY_KEYS.list({ sort: "added-desc", view: "fav" }),
  total: WORK_QUERY_KEYS.total(),
  facets: WORK_QUERY_KEYS.facets("circle"),
  tags: TAG_QUERY_KEYS.all(),
  smartWorks: SMART_FOLDER_QUERY_KEYS.works("sf-1"),
  smartPreview: SMART_FOLDER_QUERY_KEYS.preview([{ axis: "circle", op: "eq", value: "c" }]),
  notifications: WORK_QUERY_KEYS.dlsiteNotificationSummary(),
  fs: FILE_SYSTEM_QUERY_KEYS.directory("dlsite"),
  diagnostics: SCAN_QUERY_KEYS.diagnostics(),
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
  queryClient.setQueryData(KEYS.favList, structuredClone(emptyPages));
  queryClient.setQueryData(KEYS.total, { items: [], total: 0 });
  queryClient.setQueryData(KEYS.facets, []);
  queryClient.setQueryData(KEYS.tags, []);
  queryClient.setQueryData(KEYS.smartWorks, structuredClone(emptyPages));
  queryClient.setQueryData(KEYS.smartPreview, 3);
  queryClient.setQueryData(KEYS.notifications, { rjMissing: 0 });
  queryClient.setQueryData(KEYS.fs, { entries: [] });
  queryClient.setQueryData(KEYS.diagnostics, { diagnostics: [] });
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
  "favList",
  "total",
  "facets",
  "tags",
  "smartWorks",
  "smartPreview",
  "notifications",
];
const REGISTRATION_VIEWS: KeyName[] = [...LIBRARY_VIEWS, "fs", "diagnostics"];

function sorted(names: KeyName[]): KeyName[] {
  return [...names].sort();
}

describe("meta 編集の必須更新", () => {
  it("source へ応答の snapshot を書き戻し、詳細・一覧系・facet・タグ・SF・通知を無効化する", async () => {
    const queryClient = seededClient();

    await updateCachesAfterSourceEdit(queryClient, mutationResult("w1"));

    expect(sorted(invalidatedKeys(queryClient))).toEqual(sorted(["detail1", ...LIBRARY_VIEWS]));
    expect(queryClient.getQueryData(KEYS.source1)).toEqual(makeSnapshot("w1"));
  });
});

describe("再生開始時の投影反映", () => {
  it("詳細へ応答の Work を書き戻し、詳細自体は無効化しない", async () => {
    const queryClient = seededClient();
    const prepared = makeWork({ title: "投影後" });

    await updateCachesAfterPlaybackPrepared(queryClient, prepared);

    expect(queryClient.getQueryData(KEYS.detail1)).toEqual(prepared);
    expect(sorted(invalidatedKeys(queryClient))).toEqual(sorted(LIBRARY_VIEWS));
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

  it("一覧（works の list 形と smartFolderWorks）だけを無効化し、総件数・facet・詳細は無効化しない", async () => {
    const queryClient = seededClient();

    await updateCachesAfterBookmark(queryClient, { workId: "w1", bookmarked: true });

    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted(["list", "favList", "smartWorks", "smartPreview"]),
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
    expect(queryClient.getQueryCache().find({ queryKey: KEYS.favList })?.isStale()).toBe(true);
    expect(queryClient.getQueryCache().find({ queryKey: KEYS.smartWorks })?.isStale()).toBe(true);
    expect(fetchCount).toBe(0);
  });
});

describe("登録・スキャン完了の必須更新", () => {
  it("登録は一覧系・facet・タグ・SF（件数プレビューを含む）・通知・FS・診断を無効化し、詳細と scan 候補は触らない", async () => {
    const queryClient = seededClient();

    await updateCachesAfterRegistration(queryClient);

    expect(sorted(invalidatedKeys(queryClient))).toEqual(sorted(REGISTRATION_VIEWS));
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
  it("単体は対象作品のキャッシュ（詳細と source）を削除し、他の作品の詳細は残す", async () => {
    const queryClient = seededClient();

    await updateCachesAfterUnregistration(queryClient, "w1");

    expect(sorted(removedKeys(queryClient))).toEqual(sorted(["detail1", "source1"]));
    expect(sorted(invalidatedKeys(queryClient))).toEqual(sorted(REGISTRATION_VIEWS));
  });

  it("missing 一括は全詳細と登録の集合を無効化する", async () => {
    const queryClient = seededClient();

    await updateCachesAfterMissingUnregistration(queryClient);

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
  it("単体適用は source を書き戻して残し、詳細・一覧系・facet・タグ・SF・通知を無効化する", async () => {
    const queryClient = seededClient();

    await updateCachesAfterDlsiteLinkageChange(queryClient, mutationResult("w1"));

    expect(queryClient.getQueryData(KEYS.source1)).toEqual(makeSnapshot("w1"));
    expect(sorted(invalidatedKeys(queryClient))).toEqual(sorted(["detail1", ...LIBRARY_VIEWS]));
  });

  it("情報の取得は対象の詳細だけを無効化し、source は残す", async () => {
    const queryClient = seededClient();

    await updateCachesAfterDlsitePreviewFetch(queryClient, "w1");

    expect(sorted(invalidatedKeys(queryClient))).toEqual(sorted(["detail1", ...LIBRARY_VIEWS]));
  });

  it("未設定項目の一括適用は対象作品の詳細と source を無効化する", async () => {
    const queryClient = seededClient();

    await updateCachesAfterDlsiteBulkApply(queryClient, ["w1"]);

    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted(["detail1", "source1", ...LIBRARY_VIEWS]),
    );
  });

  it("一括取得の終端は処理対象を問わず全詳細と一覧系を無効化する", async () => {
    const queryClient = seededClient();

    await updateCachesAfterDlsiteBulkFetch(queryClient);

    expect(sorted(invalidatedKeys(queryClient))).toEqual(
      sorted(["detail1", "source1", "detail2", "source2", ...LIBRARY_VIEWS]),
    );
  });
});
