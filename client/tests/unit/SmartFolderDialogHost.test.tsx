import { afterEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { smartFolderDialogAtom } from "../../src/features/library/model/atoms";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import SmartFolderDialogHost from "../../src/features/library/ui/SmartFolderDialogHost";
import { mockApi } from "../helpers/api";
import { libraryRouteAtom } from "../../src/entities/library/model/navigationAtoms";
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

describe("保存中に閉じたダイアログの応答", () => {
  it("編集の保存中に閉じて別の編集を開いても、応答でそのダイアログを閉じない", async () => {
    const held = gate();
    mockApi({
      "GET /api/tag-prefixes": [],
      "GET /api/smart-folders": [...defaultSmartFolders(), folderA, folderB],
      "PUT /api/smart-folders/:id": async ({ params }) => {
        await held.promise;
        return { ...folderA, id: params.id };
      },
    });
    const store = renderHost();
    const user = userEvent.setup();

    act(() => store.set(smartFolderDialogAtom, { kind: "edit", folder: folderA }));
    await user.click(await screen.findByRole("button", { name: "保存" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    act(() => store.set(smartFolderDialogAtom, { kind: "edit", folder: folderB }));
    expect(await screen.findByRole("dialog", { name: "「乙」を編集" })).toBeInTheDocument();

    held.release();
    await act(async () => {
      await held.promise;
    });

    expect(screen.getByRole("dialog", { name: "「乙」を編集" })).toBeInTheDocument();
  });

  it("作成の保存中に閉じて別の作成を開いたら、応答でそのダイアログを閉じず、作ったものへも移らない", async () => {
    const held = gate();
    mockApi({
      "GET /api/tag-prefixes": [],
      "GET /api/smart-folders": [...defaultSmartFolders(), folderA, folderB],
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
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    act(() => store.set(smartFolderDialogAtom, { kind: "duplicate", folder: folderB }));
    expect(await screen.findByRole("dialog", { name: "「乙」を複製" })).toBeInTheDocument();

    held.release();
    await act(async () => {
      await held.promise;
    });

    expect(screen.getByRole("dialog", { name: "「乙」を複製" })).toBeInTheDocument();
    expect(store.get(libraryRouteAtom).folderId).toBe(before);
  });
});

describe("「すべて」の並びが読めないとき", () => {
  it("ダイアログは出て、「すべて」と同じは選べず、並びを選ぶまで保存できない", async () => {
    mockApi({ "GET /api/tag-prefixes": [] });
    const brokenAll = buildSmartFolder({ id: "all", name: "すべて", condition: null, sort: null });
    const folders = [brokenAll, ...defaultSmartFolders().filter((f) => f.id !== "all"), folderA];
    const store = renderHost(folders);
    const user = userEvent.setup();

    act(() => store.set(smartFolderDialogAtom, { kind: "edit", folder: folderA }));
    const select = await screen.findByLabelText("既定の並び");

    expect(screen.queryByRole("option", { name: /「すべて」と同じ/ })).toBeNull();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    await user.selectOptions(select, "title-asc");
    await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeEnabled());
  });
});
