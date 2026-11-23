import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { libraryRouteAtom } from "../../src/entities/library/model/navigationAtoms";
import {
  appRouteAtom,
  openNowPlayingLayerAtom,
} from "../../src/entities/navigation/model/appRouteStore";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";
import { useSmartFolderEditor } from "../../src/features/library/model/useSmartFolderEditor";
import { toastRequestsAtom } from "../../src/shared/model/toastRequestsAtom";
import { apiError, apiNoContent, mockApi } from "../helpers/api";
import { clearPendingOps, pendingWrites, seedLibraryRoute } from "../helpers/route";
import { nts } from "../helpers/tag";
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
  it("作れたら一覧と、その ID の作品・値の一覧を取り直し、作ったものを返す", async () => {
    mockApi({ "POST /api/smart-folders": () => ({ ...userFolder }) });
    const editor = setup();

    expect(await editor.create(write)).toEqual(userFolder);

    expect(invalidated).toEqual([
      SMART_FOLDER_QUERY_KEYS.all(),
      SMART_FOLDER_QUERY_KEYS.folderWorks(USER_ID),
      SMART_FOLDER_QUERY_KEYS.folderGroups(USER_ID),
    ]);
    expect(toasts()).toEqual([]);
  });

  it("作れたら応答の行を一覧のキャッシュへすぐ反映する（再取得を待たない・ID 単位）", async () => {
    mockApi({ "POST /api/smart-folders": () => ({ ...userFolder }) });
    const editor = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), defaultSmartFolders());
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async () => {
      expect(
        queryClient.getQueryData<{ id: string }[]>(SMART_FOLDER_QUERY_KEYS.all())?.at(-1)?.id,
      ).toBe(USER_ID);
    });

    await editor.create(write);

    expect(
      queryClient
        .getQueryData<{ id: string }[]>(SMART_FOLDER_QUERY_KEYS.all())
        ?.filter((folder) => folder.id === USER_ID),
    ).toHaveLength(1);
  });

  it("既定から追加はテンプレートの固定 ID と定義を POST し、位置は送らない", async () => {
    const api = mockApi({ "POST /api/smart-folders": () => ({ ...userFolder, id: "fav" }) });
    const editor = setup();

    await editor.addFromTemplate("fav");

    const [request] = api.requestsTo("POST /api/smart-folders");
    expect(request?.body).toMatchObject({ id: "fav", name: "お気に入り" });
    expect(request?.body).not.toHaveProperty("position");
  });

  it("既定から追加の失敗（409）は、ID の入ったサーバーの文言でなく行の名前と動詞でトーストに出し、一覧を取り直す", async () => {
    mockApi({
      "POST /api/smart-folders": () => apiError(409, "conflict", "すでにあります: fav"),
    });
    const editor = setup();

    expect(await editor.addFromTemplate("fav")).toBeNull();

    expect(toasts()[0]).toMatchObject({
      message: "「お気に入り」を追加できませんでした",
      variant: "error",
    });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });
});

describe("同じ ID の作り直し", () => {
  const listKeys = [
    SMART_FOLDER_QUERY_KEYS.works("fav", { sort: "added-desc" }),
    SMART_FOLDER_QUERY_KEYS.groups("fav", "tag", {}),
  ];
  const seed = () => {
    for (const key of listKeys) queryClient.setQueryData(key, []);
  };
  const stale = () => listKeys.map((key) => queryClient.getQueryState(key)?.isInvalidated);

  it("既定から追加すると、同じ ID の作品・値の一覧を古いものとして扱う", async () => {
    mockApi({ "POST /api/smart-folders": () => ({ ...userFolder, id: "fav" }) });
    const editor = setup();
    seed();

    await editor.addFromTemplate("fav");

    expect(stale()).toEqual([true, true]);
  });

  it("元に戻すと、同じ ID の作品・値の一覧を古いものとして扱う", async () => {
    mockApi({
      "DELETE /api/smart-folders/:id": apiNoContent(),
      "POST /api/smart-folders": () => ({ ...userFolder, id: "fav" }),
    });
    const editor = setup();
    await editor.remove({ ...userFolder, id: "fav" });
    seed();

    toasts()[0]!.onAction!();
    await vi.waitFor(() => expect(stale()).toEqual([true, true]));
  });
});

describe("失敗トーストの文言", () => {
  it("作成は行の名前と動詞で出す。サーバーに届かない失敗でも同じ", async () => {
    mockApi({ "POST /api/smart-folders": () => Promise.reject(new TypeError("network")) });
    const editor = setup();

    expect(await editor.create(write)).toBeNull();

    expect(toasts()[0]).toMatchObject({ message: "「自作」を作れませんでした", variant: "error" });
  });

  it("400 の検証エラーはサーバーの文言をそのまま出す", async () => {
    mockApi({
      "POST /api/smart-folders": () => apiError(400, "invalid_request", "名前を入力してください"),
    });
    const editor = setup();

    await editor.create(write);

    expect(toasts()[0]).toMatchObject({ message: "名前を入力してください" });
  });

  it("ルートの再設定中（409 root_reconfiguring）はサーバーの文言をそのまま出す", async () => {
    mockApi({
      "DELETE /api/smart-folders/:id": () =>
        apiError(
          409,
          "root_reconfiguring",
          "ルートフォルダーの再設定中のため、この操作はできません",
        ),
    });
    const editor = setup();

    await editor.remove(userFolder);

    expect(toasts()[0]).toMatchObject({
      message: "ルートフォルダーの再設定中のため、この操作はできません",
    });
  });

  it("保存は一覧から引いた行の名前で、引けなければ名前なしで出す", async () => {
    mockApi({ "PATCH /api/smart-folders/:id": () => apiError(404, "not_found", "見つかりません") });
    const editor = setup();

    await editor.patch(USER_ID, { sort: "random" });
    expect(toasts()[0]).toMatchObject({ message: "保存できませんでした" });

    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), [...defaultSmartFolders(), userFolder]);
    await editor.patch(USER_ID, { sort: "random" });
    expect(toasts().map((toast) => toast.message)).toContain("「自作」を保存できませんでした");
  });

  it("削除は行の名前と動詞で出す", async () => {
    mockApi({ "DELETE /api/smart-folders/:id": () => apiError(409, "conflict", "競合: sf-1") });
    const editor = setup();

    await editor.remove(userFolder);

    expect(toasts()[0]).toMatchObject({ message: "「自作」を削除できませんでした" });
  });
});

describe("保存のあとの行き先（保存を始めたときの route から動いていなければ移る）", () => {
  it("作成は新しいスマートフォルダーを絞り込みなしで開き、履歴を積む", async () => {
    mockApi({ "POST /api/smart-folders": () => ({ ...userFolder }) });
    const editor = setup();
    seedLibraryRoute(store, { folderId: "all", selectedTags: nts(["ASMR"]), q: "雨" });
    clearPendingOps(store);

    await editor.create(write);

    expect(store.get(libraryRouteAtom)).toMatchObject({
      folderId: USER_ID,
      selectedTags: [],
      q: "",
    });
    expect(pendingWrites(store)).toEqual(["push"]);
  });

  it("作成の完了を待つ間に route が動いていたら、移らずユーザーの状態を保つ", async () => {
    let release!: () => void;
    mockApi({
      "POST /api/smart-folders": async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return { ...userFolder };
      },
    });
    const editor = setup();
    seedLibraryRoute(store, { folderId: "all", q: "雨" });
    const pending = editor.create(write);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    seedLibraryRoute(store, { q: "雨宿り" });
    clearPendingOps(store);

    release();
    expect(await pending).toEqual(userFolder);

    expect(store.get(libraryRouteAtom)).toMatchObject({ folderId: "all", q: "雨宿り" });
    expect(pendingWrites(store)).toEqual([]);
  });

  it("上書き（reenter）は同じスマートフォルダーへ置き換えで入り直し、取り消しは動かさない", async () => {
    mockApi({ "PATCH /api/smart-folders/:id": () => ({ ...userFolder }) });
    const editor = setup();
    seedLibraryRoute(store, { folderId: USER_ID, selectedTags: nts(["ASMR"]), sort: "title-desc" });
    clearPendingOps(store);

    await editor.patch(USER_ID, { condition: write.condition }, { reenter: true });

    expect(store.get(libraryRouteAtom)).toMatchObject({
      folderId: USER_ID,
      selectedTags: [],
      sort: null,
    });
    expect(pendingWrites(store)).toEqual(["replace"]);

    seedLibraryRoute(store, { selectedTags: nts(["ASMR"]) });
    clearPendingOps(store);
    await editor.patch(USER_ID, { condition: write.condition });
    expect(store.get(libraryRouteAtom).selectedTags).toEqual(["ASMR"]);
    expect(pendingWrites(store)).toEqual([]);
  });

  it("上書きの完了を待つ間に層を開いていたら、移らず層を保つ", async () => {
    let release!: () => void;
    mockApi({
      "PATCH /api/smart-folders/:id": async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return { ...userFolder };
      },
    });
    const editor = setup();
    seedLibraryRoute(store, { folderId: USER_ID, selectedTags: nts(["ASMR"]) });
    const pending = editor.patch(USER_ID, { condition: write.condition }, { reenter: true });
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    store.set(openNowPlayingLayerAtom);
    clearPendingOps(store);

    release();
    await pending;

    expect(store.get(appRouteAtom)).toMatchObject({ layer: { kind: "nowPlaying" } });
    expect(store.get(libraryRouteAtom).selectedTags).toEqual(["ASMR"]);
    expect(pendingWrites(store)).toEqual([]);
  });
});

describe("定義の更新（全項目）", () => {
  it("保存できたら一覧のあと、そのフォルダーの作品と値の一覧だけ取り直す", async () => {
    mockApi({ "PATCH /api/smart-folders/:id": () => ({ ...userFolder }) });
    const editor = setup();

    expect(await editor.patch(USER_ID, write)).toBe(true);

    expect(invalidated).toEqual([
      SMART_FOLDER_QUERY_KEYS.all(),
      SMART_FOLDER_QUERY_KEYS.folderWorks(USER_ID),
      SMART_FOLDER_QUERY_KEYS.folderGroups(USER_ID),
    ]);
  });

  it("無効化されるのは保存したフォルダーの作品・値の一覧だけで、ほかのフォルダーの一覧は残る", async () => {
    mockApi({ "PATCH /api/smart-folders/:id": () => ({ ...userFolder }) });
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

    await editor.patch(USER_ID, write);

    for (const key of own) expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of other) expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  });

  it("404 でもトーストを出して一覧を取り直す。作品・値の一覧は取り直さない", async () => {
    mockApi({
      "PATCH /api/smart-folders/:id": () => apiError(404, "not_found", "見つかりません: sf-1"),
    });
    const editor = setup();

    expect(await editor.patch(USER_ID, write, { failureMessage: "元に戻せませんでした" })).toBe(
      false,
    );

    expect(toasts()[0]).toMatchObject({
      message: "元に戻せませんでした",
      variant: "error",
    });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });
});

describe("既定のソートの保存", () => {
  it("並びだけを送り、一覧だけを取り直す", async () => {
    const api = mockApi({ "PATCH /api/smart-folders/:id": () => ({ ...userFolder }) });
    const editor = setup();

    expect(await editor.patch(USER_ID, { sort: "random" })).toBe(true);

    expect(api.requestsTo("PATCH /api/smart-folders/:id")[0]!.body).toEqual({ sort: "random" });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });

  it("今の並びは外さず、応答の行を一覧のキャッシュへすぐ反映する（保存した並びと同じになるので「既定にする」は消える）", async () => {
    mockApi({ "PATCH /api/smart-folders/:id": () => ({ ...userFolder, sort: "random" }) });
    const editor = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), [...defaultSmartFolders(), userFolder]);
    seedLibraryRoute(store, { folderId: USER_ID, sort: "random" });
    clearPendingOps(store);
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async () => {});

    await editor.patch(USER_ID, { sort: "random" });

    expect(
      queryClient
        .getQueryData<(typeof userFolder)[]>(SMART_FOLDER_QUERY_KEYS.all())
        ?.find((folder) => folder.id === USER_ID)?.sort,
    ).toBe("random");
    expect(store.get(libraryRouteAtom).sort).toBe("random");
    expect(pendingWrites(store)).toEqual([]);
  });

  it("値一覧のソートの保存は groupSort だけを PATCH し、一覧だけを取り直す", async () => {
    const api = mockApi({ "PATCH /api/smart-folders/:id": () => ({ ...userFolder }) });
    const editor = setup();

    expect(await editor.patch(USER_ID, { groupSort: "last-played" })).toBe(true);

    expect(api.requestsTo("PATCH /api/smart-folders/:id")[0]!.body).toEqual({
      groupSort: "last-played",
    });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });

  it("409 でもトーストを出して一覧を取り直す", async () => {
    mockApi({
      "PATCH /api/smart-folders/:id": () => apiError(409, "conflict", "競合しました"),
    });
    const editor = setup();

    expect(await editor.patch(USER_ID, { sort: "random" })).toBe(false);

    expect(toasts()[0]).toMatchObject({ message: "保存できませんでした", variant: "error" });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });
});

describe("条件だけの更新（検索の上書き・取り消し）", () => {
  it("条件と指定した項目だけを condition へ送り、そのフォルダーの作品・値の一覧を取り直す", async () => {
    const api = mockApi({ "PATCH /api/smart-folders/:id": () => ({ ...userFolder }) });
    const editor = setup();
    const change = { condition: write.condition, sort: "title-desc" as const };

    expect(await editor.patch(USER_ID, change)).toBe(true);

    expect(api.requestsTo("PATCH /api/smart-folders/:id")[0]!.body).toEqual(change);
    expect(invalidated).toEqual([
      SMART_FOLDER_QUERY_KEYS.all(),
      SMART_FOLDER_QUERY_KEYS.folderWorks(USER_ID),
      SMART_FOLDER_QUERY_KEYS.folderGroups(USER_ID),
    ]);
  });

  it("応答の行（上書き後の条件）を、一覧の再取得が失敗する前に一覧のキャッシュへ反映する", async () => {
    const overwritten = {
      ...userFolder,
      condition: { type: "and" as const, children: [{ type: "bookmarked" as const }] },
    };
    mockApi({ "PATCH /api/smart-folders/:id": () => overwritten });
    const editor = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), [...defaultSmartFolders(), userFolder]);
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async () => {});

    await editor.patch(USER_ID, { condition: overwritten.condition });

    expect(
      queryClient
        .getQueryData<(typeof userFolder)[]>(SMART_FOLDER_QUERY_KEYS.all())
        ?.find((folder) => folder.id === USER_ID)?.condition,
    ).toEqual(overwritten.condition);
  });

  it("失敗はトーストに出して一覧を取り直す", async () => {
    mockApi({
      "PATCH /api/smart-folders/:id": () => apiError(404, "not_found", "見つかりません"),
    });
    const editor = setup();

    expect(await editor.patch(USER_ID, { condition: write.condition })).toBe(false);

    expect(toasts()[0]).toMatchObject({ message: "保存できませんでした", variant: "error" });
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });
});

describe("更新とグループ分けの変更", () => {
  const grouped = { ...userFolder, groupBy: { kind: "tag" as const } };

  async function updateWith(next: typeof grouped | typeof userFolder, route: string | null) {
    mockApi({ "PATCH /api/smart-folders/:id": () => ({ ...next }) });
    const editor = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), [grouped]);
    if (route) seedLibraryRoute(store, { folderId: route, group: "cv/x" });
    clearPendingOps(store);
    await editor.patch(USER_ID, { ...write, groupBy: next.groupBy });
  }

  it("開いている一覧のグループ分けを変えたら、履歴を積まずに入り直して ?group= を外す", async () => {
    await updateWith(userFolder, USER_ID);

    expect(store.get(libraryRouteAtom)).toMatchObject({ folderId: USER_ID, group: null });
    expect(pendingWrites(store)).toEqual(["replace"]);
  });

  it("group と groupSort だけを外し、チップ・検索語・並びは残す。キャッシュへ反映する前に外す", async () => {
    mockApi({ "PATCH /api/smart-folders/:id": () => ({ ...userFolder }) });
    const editor = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), [grouped]);
    seedLibraryRoute(store, {
      folderId: USER_ID,
      group: "cv/x",
      groupSort: "name-asc",
      selectedTags: nts(["ASMR"]),
      q: "雨",
      sort: "title-asc",
    });
    const groupWhenCached: Array<string | null> = [];
    queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        groupWhenCached.push(store.get(libraryRouteAtom).group);
      }
    });

    await editor.patch(USER_ID, { ...write, groupBy: null });

    expect(groupWhenCached[0]).toBeNull();
    expect(store.get(libraryRouteAtom)).toMatchObject({
      group: null,
      groupSort: null,
      selectedTags: ["ASMR"],
      q: "雨",
      sort: "title-asc",
    });
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

  it("並べ替えは取得中の件数を取り消さない", async () => {
    mockApi({ "PUT /api/smart-folders/order": () => defaultSmartFolders().reverse() });
    const editor = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), defaultSmartFolders());
    let resolveCounts!: (counts: Record<string, number>) => void;
    const fetching = queryClient.prefetchQuery({
      queryKey: SMART_FOLDER_QUERY_KEYS.counts(),
      queryFn: () => new Promise<Record<string, number>>((resolve) => (resolveCounts = resolve)),
    });

    await editor.reorder(reversed);
    resolveCounts({ recent: 3 });
    await fetching;

    expect(queryClient.getQueryData(SMART_FOLDER_QUERY_KEYS.counts())).toEqual({ recent: 3 });
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

describe("削除", () => {
  it("消したら一覧のキャッシュから外して「元に戻す」を出す。route の退避は補正に任せ、ここでは動かさない", async () => {
    mockApi({ "DELETE /api/smart-folders/:id": apiNoContent() });
    const editor = setup();
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), [...defaultSmartFolders(), userFolder]);
    seedLibraryRoute(store, { folderId: USER_ID, q: "x" });
    clearPendingOps(store);
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async () => {});

    await editor.remove(userFolder);

    expect(
      queryClient
        .getQueryData<{ id: string }[]>(SMART_FOLDER_QUERY_KEYS.all())
        ?.some((folder) => folder.id === USER_ID),
    ).toBe(false);
    expect(store.get(libraryRouteAtom)).toMatchObject({ folderId: USER_ID, q: "x" });
    expect(pendingWrites(store)).toEqual([]);
    expect(toasts()[0]).toMatchObject({
      message: "「自作」を削除しました",
      variant: "success",
      actionLabel: "元に戻す",
    });
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

  it("失敗（404・409）はトーストを出して一覧を取り直し、route は動かさない", async () => {
    mockApi({
      "DELETE /api/smart-folders/:id": () => apiError(404, "not_found", "見つかりません: sf-1"),
    });
    const editor = setup();
    seedLibraryRoute(store, { folderId: USER_ID });

    await editor.remove(userFolder);

    expect(toasts()[0]).toMatchObject({
      message: "「自作」を削除できませんでした",
      variant: "error",
    });
    expect(store.get(libraryRouteAtom).folderId).toBe(USER_ID);
    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });

  it("元に戻すは削除した行を同じ定義で復元して一覧を取り直す", async () => {
    const mocked = mockApi({
      "DELETE /api/smart-folders/:id": apiNoContent(),
      "POST /api/smart-folders": () => ({ ...userFolder }),
    });
    const editor = setup();
    await editor.remove({ ...userFolder, condition: write.condition });
    invalidated.length = 0;

    toasts()[0]!.onAction!();
    await vi.waitFor(() =>
      expect(invalidated).toEqual([
        SMART_FOLDER_QUERY_KEYS.all(),
        SMART_FOLDER_QUERY_KEYS.folderWorks(USER_ID),
        SMART_FOLDER_QUERY_KEYS.folderGroups(USER_ID),
      ]),
    );

    expect(mocked.requestsTo("POST /api/smart-folders")[0]!.body).toMatchObject({
      id: USER_ID,
      name: "自作",
      condition: write.condition,
      position: 0,
    });
  });

  it("元に戻せなかったときはトーストを出して一覧を取り直す", async () => {
    mockApi({
      "DELETE /api/smart-folders/:id": apiNoContent(),
      "POST /api/smart-folders": () => apiError(409, "conflict", "すでにあります: sf-1"),
    });
    const editor = setup();
    await editor.remove({ ...userFolder, condition: write.condition });
    invalidated.length = 0;

    toasts()[0]!.onAction!();
    await vi.waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        message: "元に戻せませんでした",
        variant: "error",
      }),
    );

    expect(invalidated).toEqual([SMART_FOLDER_QUERY_KEYS.all()]);
  });
});
