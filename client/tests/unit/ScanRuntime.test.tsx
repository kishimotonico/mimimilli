// ScanRuntime（entities/scan配下）が出すエラートーストの単体テスト。scanErrorAtomは
// SetupScreenがインライン表示にも使う「エラー状態」として残し、表示自体はuseToastへ
// 出す契約を固定する。
import { createElement, Fragment, useMemo } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { scanActionsAtom, scanErrorAtom } from "../../src/entities/scan/model/atoms";

function response(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: status === 204 ? undefined : { "Content-Type": "application/json" },
  });
}

function renderRuntime() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();

  function Wrapper() {
    const client = useMemo(() => queryClient, []);
    const jotaiStore = useMemo(() => store, []);
    return createElement(
      QueryClientProvider,
      { client },
      createElement(
        JotaiProvider,
        { store: jotaiStore },
        createElement(Fragment, null, createElement(ScanRuntime), createElement(GlobalToast)),
      ),
    );
  }

  render(createElement(Wrapper));
  return { store };
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ScanRuntime", () => {
  it("スキャン開始に失敗するとerrorトーストを出し、閉じるとscanErrorAtomも消える", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(null, 204);
        if (url.endsWith("/scan")) return response({ message: "開始できませんでした" }, 500);
        return response(null, 204);
      }),
    );

    const { store } = renderRuntime();
    await waitFor(() => expect(store.get(scanActionsAtom)).not.toBeNull());

    await act(async () => {
      await store.get(scanActionsAtom)!.start();
    });

    await waitFor(() => expect(store.get(scanErrorAtom)).not.toBeNull());
    const message = store.get(scanErrorAtom)!;
    expect(screen.getByText(message)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    await waitFor(() => expect(store.get(scanErrorAtom)).toBeNull());
    await waitFor(() => expect(screen.queryByText(message)).toBeNull());
  });
});
