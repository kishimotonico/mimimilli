import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import BrokenFolderPane from "../../src/features/library/ui/BrokenFolderPane";
import { buildSmartFolder } from "../helpers/smartFolders";

afterEach(cleanup);

function renderPane(props: Parameters<typeof BrokenFolderPane>[0]) {
  render(
    <Provider store={createStore()}>
      <QueryClientProvider client={new QueryClient()}>
        <BrokenFolderPane {...props} />
      </QueryClientProvider>
    </Provider>,
  );
}

describe("BrokenFolderPane", () => {
  it("読めない行は削除を出す", () => {
    renderPane({
      folder: buildSmartFolder({ id: "sf-x", name: "壊れた", condition: null }),
      reason: "folder",
    });

    expect(screen.getByText("このスマートフォルダーは読めません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
  });

  it("壊れた「すべて」は削除を出さない", () => {
    renderPane({
      folder: buildSmartFolder({ id: "all", name: "すべて", condition: null }),
      reason: "folder",
    });

    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
  });

  it("「すべて」の並びが読めないための行は、理由を出し削除を出さない", () => {
    renderPane({ folder: buildSmartFolder({ id: "sf-x", name: "自作" }), reason: "sort" });

    expect(screen.getByText("「すべて」の並びが読めないため開けません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
  });
});
