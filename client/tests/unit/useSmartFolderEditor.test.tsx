import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { libraryRouteAtom } from "../../src/entities/library/model/navigationAtoms";
import { appRouteAtom } from "../../src/entities/navigation/model/appRouteStore";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";
import { useSmartFolderEditor } from "../../src/features/library/model/useSmartFolderEditor";
import { toastRequestsAtom } from "../../src/shared/model/toastRequestsAtom";
import { apiError, apiNoContent, mockApi } from "../helpers/api";
import { clearPendingOps, pendingWrites, seedAppMode, seedLibraryRoute } from "../helpers/route";
import { buildSmartFolder, defaultSmartFolders } from "../helpers/smartFolders";

const USER_ID = "sf-00000000-0000-4000-8000-000000000001";
const userFolder = buildSmartFolder({ id: USER_ID, name: "自作", sort: "title-asc" });
const write = {
  name: "自作",
  condition: { type: "and" as const, children: [] },
  sort: "added-desc" as const,
  groupBy: null,
};

let store: ReturnType<typeof createStore>;
let queryClient: QueryClient;
let invalidated: unknown[][];

function setup() {
  store = createStore();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidated = [];
  const original = queryClient.invalidateQueries.bind(queryClient);
  vi.spyOn(queryClient, "invalidateQueries").mockImplementation((filters, options) => {
    invalidated.push([...(filters?.queryKey ?? [])]);
    return original(filters, options);
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      Provider,
      { store },
      createElement(QueryClientProvider, { client: queryClient }, children),
    );
  return renderHook(() => useSmartFolderEditor(), { wrapper }).result.current;
}

const toasts = () => [...store.get(toastRequestsAtom).values()];

describe("作成・既定から追加", () => {
  it("作れたら一覧だけを取り直し、作ったものを返す", async () => {
    mockApi({ "POST /api/smart-folders": () => ({ ...userFolder }) });
    const editor = setup();

    expect(await editor.create(write)).toEqual(userFolder);

    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
    expect(toasts()).toEqual([]);
  });

  it("失敗はサーバーの文言でトーストに出し、一覧を取り直す", async () => {
    mockApi({
      "POST /api/smart-folders/from-template": () =>
        apiError(409, "conflict", "すでにあるスマートフォルダーです: fav"),
    });
    const editor = setup();

    expect(await editor.addFromTemplate("fav")).toBeNull();

    expect(toasts()[0]).toMatchObject({
      message: "すでにあるスマートフォルダーです: fav",
      variant: "error",
    });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });
});

describe("更新", () => {
  it("保存できたら一覧のあと、そのフォルダーの作品と値の一覧だけ取り直す", async () => {
    mockApi({ "PUT /api/smart-folders/:id": () => ({ ...userFolder }) });
    const editor = setup();

    expect(await editor.update(USER_ID, write)).toBe(true);

    expect(invalidated).toEqual([
      SMART_FOLDER_QUERY_KEYS.all(),
      SMART_FOLDER_QUERY_KEYS.folderWorks(USER_ID),
      SMART_FOLDER_QUERY_KEYS.folderGroups(USER_ID),
    ]);
  });

  it("無効化されるのは保存したフォルダーの作品・値の一覧だけで、ほかのフォルダーの一覧は残る", async () => {
    mockApi({ "PUT /api/smart-folders/:id": () => ({ ...userFolder }) });
    const editor = setup();
    const own = [
      SMART_FOLDER_QUERY_KEYS.works(USER_ID, { sort: "added-desc" }),
      SMART_FOLDER_QUERY_KEYS.groups(USER_ID, "prefix:cv", {}),
    ];
    const other = [
      SMART_FOLDER_QUERY_KEYS.works("sf-other", { sort: "added-desc" }),
      SMART_FOLDER_QUERY_KEYS.groups("sf-other", "prefix:cv", {}),
    ];
    for (const key of [...own, ...other]) queryClient.setQueryData(key, []);

    await editor.update(USER_ID, write);

    for (const key of own) expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of other) expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  });

  it("404 でもトーストを出して一覧を取り直す。作品・値の一覧は取り直さない", async () => {
    mockApi({
      "PUT /api/smart-folders/:id": () =>
        apiError(404, "not_found", "スマートフォルダーが見つかりません"),
    });
    const editor = setup();

    expect(await editor.update(USER_ID, write, "元に戻せませんでした")).toBe(false);

    expect(toasts()[0]).toMatchObject({
      message: "スマートフォルダーが見つかりません",
      variant: "error",
    });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });
});

describe("既定の並びの保存", () => {
  it("並びだけを送り、一覧だけを取り直す", async () => {
    const api = mockApi({ "PUT /api/smart-folders/:id/sort": () => ({ ...userFolder }) });
    const editor = setup();

    expect(await editor.saveDefaultSort(USER_ID, "random")).toBe(true);

    expect(api.requestsTo("PUT /api/smart-folders/:id/sort")[0]!.body).toEqual({ sort: "random" });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });

  it("値の並びの保存は group-sort へ送り、一覧だけを取り直す", async () => {
    const api = mockApi({ "PUT /api/smart-folders/:id/group-sort": () => ({ ...userFolder }) });
    const editor = setup();

    expect(await editor.saveDefaultGroupSort(USER_ID, "last-played")).toBe(true);

    expect(api.requestsTo("PUT /api/smart-folders/:id/group-sort")[0]!.body).toEqual({
      groupSort: "last-played",
    });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });

  it("409 でもトーストを出して一覧を取り直す", async () => {
    mockApi({
      "PUT /api/smart-folders/:id/sort": () => apiError(409, "conflict", "競合しました"),
    });
    const editor = setup();

    expect(await editor.saveDefaultSort(USER_ID, "random")).toBe(false);

    expect(toasts()[0]).toMatchObject({ message: "競合しました", variant: "error" });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });
});

describe("更新とグループ分けの変更", () => {
  const grouped = { ...userFolder, groupBy: { kind: "tag" as const } };

  async function updateWith(next: typeof grouped | typeof userFolder, route: string | null) {
    mockApi({ "PUT /api/smart-folders/:id": () => ({ ...next }) });
    const editor = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), [grouped]);
    if (route) seedLibraryRoute(store, { folderId: route, group: "cv/x" });
    clearPendingOps(store);
    await editor.update(USER_ID, { ...write, groupBy: next.groupBy });
  }

  it("開いている一覧のグループ分けを変えたら、履歴を積まずに入り直して ?group= を外す", async () => {
    await updateWith(userFolder, USER_ID);

    expect(store.get(libraryRouteAtom)).toMatchObject({ folderId: USER_ID, group: null });
    expect(pendingWrites(store)).toEqual(["replace"]);
  });

  it("グループ分けが同じなら route は動かさない", async () => {
    await updateWith(grouped, USER_ID);

    expect(store.get(libraryRouteAtom).group).toBe("cv/x");
    expect(pendingWrites(store)).toEqual([]);
  });

  it("開いていない一覧のグループ分けを変えても route は動かさない", async () => {
    await updateWith(userFolder, "fav");

    expect(store.get(libraryRouteAtom).folderId).toBe("fav");
    expect(pendingWrites(store)).toEqual([]);
  });
});

describe("並べ替え", () => {
  const ids = defaultSmartFolders().map((folder) => folder.id);
  const reversed = [...ids].reverse();

  it("先に画面へ反映し、応答の一覧で置き換える。取り直しはしない", async () => {
    const rows = defaultSmartFolders().reverse();
    mockApi({ "PUT /api/smart-folders/order": () => rows });
    const editor = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), defaultSmartFolders());

    await editor.reorder(reversed);

    expect(queryClient.getQueryData(SMART_FOLDER_QUERY_KEYS.all())).toEqual(rows);
    expect(invalidated).toEqual([]);
  });

  it("失敗したら一覧を取り直して戻し、トーストを出す", async () => {
    mockApi({
      "PUT /api/smart-folders/order": () => apiError(400, "invalid_request", "過不足があります"),
    });
    const editor = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), defaultSmartFolders());

    await editor.reorder(reversed);

    expect(toasts()[0]).toMatchObject({ message: "過不足があります", variant: "error" });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });
});

describe("並べ替えの直列化", () => {
  it("連続した並べ替えは1本ずつ送り、待つ間は最新の順だけを送って最新の順が残る", async () => {
    const base = defaultSmartFolders();
    const orders = [
      base.map((f) => f.id).reverse(),
      base.map((f) => f.id).sort(),
      base.map((f) => f.id),
    ];
    const releases: Array<() => void> = [];
    const sent: string[][] = [];
    mockApi({
      "PUT /api/smart-folders/order": async ({ body }) => {
        const ids = (body as { ids: string[] }).ids;
        sent.push(ids);
        await new Promise<void>((resolve) => releases.push(resolve));
        const byId = new Map(base.map((f) => [f.id, f]));
        return ids.map((id, position) => ({ ...byId.get(id)!, position }));
      },
    });
    const editor = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), base);

    const first = editor.reorder(orders[0]!);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const second = editor.reorder(orders[1]!);
    const third = editor.reorder(orders[2]!);
    await Promise.all([second, third]);
    expect(sent).toHaveLength(1);

    releases[0]!();
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toEqual(orders[2]);
    releases[1]!();
    await first;

    const final = queryClient.getQueryData<{ id: string }[]>(SMART_FOLDER_QUERY_KEYS.all());
    expect(final?.map((f) => f.id)).toEqual(orders[2]);
  });
});

describe("並べ替えの直列化: 再マウント", () => {
  it("フックを作り直しても、送信中の保存があれば待ってから最新の順だけを送る", async () => {
    const base = defaultSmartFolders();
    const ids = base.map((f) => f.id);
    const releases: Array<() => void> = [];
    const sent: string[][] = [];
    mockApi({
      "PUT /api/smart-folders/order": async ({ body }) => {
        sent.push((body as { ids: string[] }).ids);
        await new Promise<void>((resolve) => releases.push(resolve));
        return base;
      },
    });
    const first = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), base);
    const inFlight = first.reorder([...ids].reverse());
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    const remounted = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), base);
    await remounted.reorder(ids);
    expect(sent).toHaveLength(1);

    releases[0]!();
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toEqual(ids);
    releases[1]!();
    await inFlight;
  });
});

describe("削除", () => {
  it("開いているスマートフォルダーを消したら、履歴を積まずに「すべて」へ移り、元に戻すを出す", async () => {
    mockApi({ "DELETE /api/smart-folders/:id": apiNoContent() });
    const editor = setup();
    seedLibraryRoute(store, { folderId: USER_ID, q: "x" });
    clearPendingOps(store);

    await editor.remove(userFolder);

    expect(store.get(libraryRouteAtom)).toMatchObject({ folderId: "all", q: "" });
    expect(pendingWrites(store)).toEqual(["replace"]);
    expect(toasts()[0]).toMatchObject({
      message: "「自作」を削除しました",
      variant: "success",
      actionLabel: "元に戻す",
    });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });

  it("作品詳細で保持しているスマートフォルダーを消しても、画面を保ったまま「すべて」へ置き換える", async () => {
    mockApi({ "DELETE /api/smart-folders/:id": apiNoContent() });
    const editor = setup();
    seedLibraryRoute(store, { folderId: USER_ID });
    seedAppMode(store, { workDetail: "work-1" });

    await editor.remove(userFolder);

    expect(store.get(libraryRouteAtom).folderId).toBe("all");
    expect(store.get(appRouteAtom)).toMatchObject({ mode: "workDetail", workId: "work-1" });
  });

  it("開いていないスマートフォルダーを消しても route は動かさない", async () => {
    mockApi({ "DELETE /api/smart-folders/:id": apiNoContent() });
    const editor = setup();
    seedLibraryRoute(store, { folderId: "fav" });
    clearPendingOps(store);

    await editor.remove(userFolder);

    expect(store.get(libraryRouteAtom).folderId).toBe("fav");
    expect(pendingWrites(store)).toEqual([]);
  });

  it("壊れた行は戻せないので元に戻すを出さず、開いていれば同じく「すべて」へ置き換える", async () => {
    mockApi({ "DELETE /api/smart-folders/:id": apiNoContent() });
    const editor = setup();
    seedLibraryRoute(store, { folderId: USER_ID });
    clearPendingOps(store);

    await editor.remove({ ...userFolder, condition: null, sort: null });

    expect(toasts()[0]!.actionLabel).toBeUndefined();
    expect(store.get(libraryRouteAtom).folderId).toBe("all");
    expect(pendingWrites(store)).toEqual(["replace"]);
  });

  it("失敗（404・409）はトーストを出して一覧を取り直し、route は動かさない", async () => {
    mockApi({
      "DELETE /api/smart-folders/:id": () =>
        apiError(404, "not_found", "スマートフォルダーが見つかりません"),
    });
    const editor = setup();
    seedLibraryRoute(store, { folderId: USER_ID });

    await editor.remove(userFolder);

    expect(toasts()[0]).toMatchObject({
      message: "スマートフォルダーが見つかりません",
      variant: "error",
    });
    expect(store.get(libraryRouteAtom).folderId).toBe(USER_ID);
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });

  it("元に戻すは削除した行を同じ定義で復元して一覧を取り直す", async () => {
    const mocked = mockApi({
      "DELETE /api/smart-folders/:id": apiNoContent(),
      "POST /api/smart-folders/restore": () => ({ ...userFolder }),
    });
    const editor = setup();
    await editor.remove({ ...userFolder, condition: write.condition });
    invalidated.length = 0;

    toasts()[0]!.onAction!();
    await vi.waitFor(() => expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]));

    expect(mocked.requestsTo("POST /api/smart-folders/restore")[0]!.body).toMatchObject({
      id: USER_ID,
      name: "自作",
      condition: write.condition,
      position: 0,
    });
  });

  it("元に戻せなかったときはトーストを出して一覧を取り直す", async () => {
    mockApi({
      "DELETE /api/smart-folders/:id": apiNoContent(),
      "POST /api/smart-folders/restore": () =>
        apiError(409, "conflict", "すでにあるスマートフォルダーです"),
    });
    const editor = setup();
    await editor.remove({ ...userFolder, condition: write.condition });
    invalidated.length = 0;

    toasts()[0]!.onAction!();
    await vi.waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        message: "すでにあるスマートフォルダーです",
        variant: "error",
      }),
    );

    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });
});
