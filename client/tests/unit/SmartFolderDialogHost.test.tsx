import { afterEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { smartFolderDialogAtom } from "../../src/features/library/model/atoms";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import SmartFolderDialogHost from "../../src/features/library/ui/SmartFolderDialogHost";
import { apiError, mockApi } from "../helpers/api";
import { buildTagPrefix } from "../helpers/builders";
import { libraryRouteAtom } from "../../src/entities/library/model/navigationAtoms";
import {
  appRouteAtom,
  openNowPlayingLayerAtom,
} from "../../src/entities/navigation/model/appRouteStore";
import {
  buildSmartFolder,
  createSmartFolderQueryClient,
  defaultSmartFolders,
} from "../helpers/smartFolders";
import type { SmartFolder } from "@mimimilli/shared";

afterEach(cleanup);

describe("SmartFolderDialogHost", () => {
  it("サイドバーが無くても、atom に入れた保存のダイアログを出し、入れる前は出さない", async () => {
    mockApi({ "GET /api/tag-prefixes": [] });
    const store = createStore();
    render(
      <Provider store={store}>
        <QueryClientProvider client={createSmartFolderQueryClient()}>
          <LibraryNavigationProvider>
            <SmartFolderDialogHost />
          </LibraryNavigationProvider>
        </QueryClientProvider>
      </Provider>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      store.set(smartFolderDialogAtom, {
        kind: "save",
        draft: {
          name: "雨",
          condition: { type: "and", children: [{ type: "text", q: "雨" }] },
          sort: null,
          groupBy: null,
        },
      });
    });
    expect(await screen.findByRole("dialog", { name: "検索を保存" })).toBeInTheDocument();
    expect(screen.getByLabelText("名前")).toHaveValue("雨");
  });
});

const folderA = buildSmartFolder({ id: "sf-00000000-0000-4000-8000-00000000000a", name: "甲" });
const folderB = buildSmartFolder({ id: "sf-00000000-0000-4000-8000-00000000000b", name: "乙" });
const draft = {
  name: "雨",
  condition: { type: "and" as const, children: [] },
  sort: "title-asc" as const,
  groupBy: null,
};

function renderHost(folders: SmartFolder[] = [...defaultSmartFolders(), folderA, folderB]) {
  const store = createStore();
  render(
    <Provider store={store}>
      <QueryClientProvider client={createSmartFolderQueryClient(folders)}>
        <LibraryNavigationProvider>
          <SmartFolderDialogHost />
        </LibraryNavigationProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return store;
}

function gate() {
  let release: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("作成の保存中に移った画面", () => {
  it("保存中に層を開いたら、作ったあとも層と画面を動かさない", async () => {
    const held = gate();
    mockApi({
      "GET /api/tag-prefixes": [],
      "GET /api/smart-folders": [...defaultSmartFolders(), folderA],
      "POST /api/smart-folders": async () => {
        await held.promise;
        return { ...folderA };
      },
    });
    const store = renderHost();
    const user = userEvent.setup();
    const before = store.get(libraryRouteAtom).folderId;

    act(() => store.set(smartFolderDialogAtom, { kind: "save", draft }));
    await user.click(await screen.findByRole("button", { name: "保存" }));
    act(() => store.set(openNowPlayingLayerAtom));

    held.release();
    await act(async () => {
      await held.promise;
    });

    await waitFor(() => expect(store.get(smartFolderDialogAtom)).toBeNull());
    expect(store.get(appRouteAtom).layer).not.toBeNull();
    expect(store.get(libraryRouteAtom).folderId).toBe(before);
  });

  it("画面を動かさなかったときは、作ったフォルダーを開く", async () => {
    mockApi({
      "GET /api/tag-prefixes": [],
      "GET /api/smart-folders": [...defaultSmartFolders(), folderA],
      "POST /api/smart-folders": () => ({ ...folderA }),
    });
    const store = renderHost();
    const user = userEvent.setup();

    act(() => store.set(smartFolderDialogAtom, { kind: "save", draft }));
    await user.click(await screen.findByRole("button", { name: "保存" }));

    await waitFor(() => expect(store.get(libraryRouteAtom).folderId).toBe(folderA.id));
  });
});

describe("作成のあとの一覧の再取得が失敗したとき", () => {
  it("新しいフォルダーを開いたまま「すべて」へ戻さない", async () => {
    mockApi({
      "GET /api/tag-prefixes": [],
      "GET /api/smart-folders": () => apiError(500, "internal", "失敗"),
      "POST /api/smart-folders": () => ({ ...folderA }),
    });
    const store = renderHost(defaultSmartFolders());
    const user = userEvent.setup();

    act(() => store.set(smartFolderDialogAtom, { kind: "save", draft }));
    await user.click(await screen.findByRole("button", { name: "保存" }));

    await waitFor(() => expect(store.get(smartFolderDialogAtom)).toBeNull());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(store.get(libraryRouteAtom).folderId).toBe(folderA.id);
  });
});

describe("保存中のダイアログ", () => {
  it("×・キャンセル・Esc では閉じられず、保存が終わったら閉じる", async () => {
    const held = gate();
    mockApi({
      "GET /api/tag-prefixes": [],
      "GET /api/smart-folders": [...defaultSmartFolders(), folderA],
      "PATCH /api/smart-folders/:id": async () => {
        await held.promise;
        return { ...folderA };
      },
    });
    const store = renderHost();
    const user = userEvent.setup();

    act(() => store.set(smartFolderDialogAtom, { kind: "edit", folder: folderA }));
    await user.type(await screen.findByRole("textbox", { name: "名前" }), "改");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeDisabled();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(store.get(smartFolderDialogAtom)).not.toBeNull();

    held.release();
    await act(async () => {
      await held.promise;
    });
    await waitFor(() => expect(store.get(smartFolderDialogAtom)).toBeNull());
  });

  it("名前だけ変えたら名前だけを送り、変更が無ければ何も送らず閉じる", async () => {
    const api = mockApi({
      "GET /api/tag-prefixes": [],
      "GET /api/smart-folders": [...defaultSmartFolders(), folderA],
      "PATCH /api/smart-folders/:id": () => ({ ...folderA, name: `${folderA.name}改` }),
    });
    const store = renderHost();
    const user = userEvent.setup();

    act(() => store.set(smartFolderDialogAtom, { kind: "edit", folder: folderA }));
    await user.click(await screen.findByRole("button", { name: "保存" }));
    await waitFor(() => expect(store.get(smartFolderDialogAtom)).toBeNull());
    expect(api.requestsTo("PATCH /api/smart-folders/:id")).toHaveLength(0);

    act(() => store.set(smartFolderDialogAtom, { kind: "edit", folder: folderA }));
    await user.type(await screen.findByRole("textbox", { name: "名前" }), "改");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(store.get(smartFolderDialogAtom)).toBeNull());
    expect(api.requestsTo("PATCH /api/smart-folders/:id")[0]?.body).toEqual({
      name: `${folderA.name}改`,
    });
  });
});

describe("保存中の入力欄", () => {
  const grouped = buildSmartFolder({
    id: "sf-00000000-0000-4000-8000-0000000000c2",
    name: "年別",
    groupBy: { kind: "addedYear" },
    groupSort: "name-desc",
    condition: { type: "and", children: [{ type: "bookmarked" }] },
  });

  it("保存を待つ間は名前・条件の削除・グループ分け・2つの並びを操作できず、失敗したら同じ下書きで再開できる", async () => {
    const held = gate();
    mockApi({
      "GET /api/tag-prefixes": [],
      "GET /api/smart-folders": [...defaultSmartFolders(), grouped],
      "PATCH /api/smart-folders/:id": async () => {
        await held.promise;
        return apiError(409, "conflict", "競合しました");
      },
    });
    const store = renderHost([...defaultSmartFolders(), grouped]);
    const user = userEvent.setup();

    act(() => store.set(smartFolderDialogAtom, { kind: "edit", folder: grouped }));
    const name = await screen.findByLabelText("名前");
    await user.clear(name);
    await user.type(name, "新しい名前");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByLabelText("名前")).toBeDisabled();
    expect(screen.getByRole("button", { name: "この条件を外す" })).toBeDisabled();
    expect(screen.getByLabelText("グループ分け")).toBeDisabled();
    expect(screen.getByLabelText("値の並び")).toBeDisabled();
    expect(screen.getByLabelText("作品の並び")).toBeDisabled();

    held.release();
    await waitFor(() => expect(screen.getByLabelText("名前")).toBeEnabled());
    expect(screen.getByLabelText("名前")).toHaveValue("新しい名前");
    expect(screen.getByLabelText("値の並び")).toBeEnabled();
    expect(store.get(smartFolderDialogAtom)).not.toBeNull();
  });
});

describe("グループ分けがあるときの並びの欄", () => {
  const grouped = buildSmartFolder({
    id: "sf-00000000-0000-4000-8000-0000000000c1",
    name: "シリーズ",
    groupBy: { kind: "prefix", prefix: "cv" },
    groupSort: "last-played",
    sort: "title-asc",
  });

  it("「値の並び」「作品の並び」の2欄を出し、グループ分けなしでは「既定の並び」1欄だけを出す", async () => {
    mockApi({ "GET /api/tag-prefixes": [] });
    const store = renderHost([...defaultSmartFolders(), grouped, folderA]);

    act(() => store.set(smartFolderDialogAtom, { kind: "edit", folder: grouped }));
    expect(await screen.findByLabelText("値の並び")).toHaveValue("last-played");
    expect(screen.getByLabelText("作品の並び")).toHaveValue("title-asc");
    expect(screen.queryByLabelText("既定の並び")).toBeNull();

    act(() => store.set(smartFolderDialogAtom, null));
    act(() => store.set(smartFolderDialogAtom, { kind: "edit", folder: folderA }));
    expect(await screen.findByLabelText("既定の並び")).toBeInTheDocument();
    expect(screen.queryByLabelText("値の並び")).toBeNull();
  });

  it("グループ分けを変えると値の並びはそのグループ分けの初期値になり、開いたときのグループ分けに戻すと保存済みの値に戻る", async () => {
    mockApi({
      "GET /api/tag-prefixes": [
        buildTagPrefix({ prefix: "cv", label: "CV", color: "cv", protected: true }),
      ],
    });
    const store = renderHost([...defaultSmartFolders(), grouped]);
    const user = userEvent.setup();

    act(() => store.set(smartFolderDialogAtom, { kind: "edit", folder: grouped }));
    const groupBySelect = await screen.findByLabelText("グループ分け");

    await user.selectOptions(groupBySelect, "addedYear");
    expect(screen.getByLabelText("値の並び")).toHaveValue("name-desc");

    await user.selectOptions(groupBySelect, "prefix:cv");
    expect(screen.getByLabelText("値の並び")).toHaveValue("last-played");

    await user.selectOptions(groupBySelect, "");
    expect(screen.queryByLabelText("値の並び")).toBeNull();
    expect(screen.getByLabelText("既定の並び")).toBeInTheDocument();
  });
});
