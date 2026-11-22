import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import {
  closeSmartFolderDialogIfOpen,
  smartFolderDialogAtom,
} from "../../src/features/library/model/atoms";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import SmartFolderDialogHost from "../../src/features/library/ui/SmartFolderDialogHost";
import { mockApi } from "../helpers/api";
import { createSmartFolderQueryClient } from "../helpers/smartFolders";

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

describe("保存の完了でダイアログを閉じる", () => {
  const draft = {
    name: "雨",
    condition: { type: "and" as const, children: [] },
    sort: null,
    groupBy: null,
  };

  it("保存を始めたダイアログがまだ開いていれば閉じる", () => {
    const store = createStore();
    const started = { kind: "save" as const, draft };
    store.set(smartFolderDialogAtom, started);

    expect(closeSmartFolderDialogIfOpen(store, started)).toBe(true);
    expect(store.get(smartFolderDialogAtom)).toBeNull();
  });

  it("保存中に閉じて次のダイアログを開いていたら、そちらは閉じない", () => {
    const store = createStore();
    const started = { kind: "save" as const, draft };
    store.set(smartFolderDialogAtom, started);
    store.set(smartFolderDialogAtom, null);
    const next = { kind: "save" as const, draft };
    store.set(smartFolderDialogAtom, next);

    expect(closeSmartFolderDialogIfOpen(store, started)).toBe(false);
    expect(store.get(smartFolderDialogAtom)).toBe(next);
  });
});
