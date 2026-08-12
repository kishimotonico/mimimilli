import { createElement, Fragment } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DlsiteBulkResult } from "@mimimilli/shared";
import GlobalToast from "../../src/app/ui/GlobalToast";
import DlsiteBulkApplyRuntime from "../../src/features/dlsite/ui/DlsiteBulkApplyRuntime";
import { errorToastAtom } from "../../src/shared/model/errorToastAtom";
import { scanErrorAtom } from "../../src/entities/scan/model/atoms";
import {
  dlsiteBulkCancelledResultAtom,
  dlsiteBulkErrorAtom,
  dlsiteBulkResultAtom,
} from "../../src/entities/dlsite/model/bulkAtoms";

const sampleDlsiteResult: DlsiteBulkResult = {
  fetched: 2,
  failed: 0,
  parseErrors: 0,
  skipped: 0,
};

function renderGlobalToast(store: ReturnType<typeof createStore>, withApplyRuntime = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const children = withApplyRuntime
    ? createElement(
        Fragment,
        null,
        createElement(GlobalToast),
        createElement(DlsiteBulkApplyRuntime),
      )
    : createElement(GlobalToast);

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, children),
    ),
  );
}

describe("GlobalToast", () => {
  it("errorToastAtom のメッセージを表示する", () => {
    const store = createStore();
    store.set(errorToastAtom, "ライブラリのエクスポートに失敗しました");

    renderGlobalToast(store);

    expect(screen.getByText("ライブラリのエクスポートに失敗しました")).toBeTruthy();
  });

  it("scanErrorAtom のメッセージを表示する", () => {
    const store = createStore();
    store.set(scanErrorAtom, "start failed");

    renderGlobalToast(store);

    expect(screen.getByText("start failed")).toBeTruthy();
  });

  it("dlsiteBulkErrorAtom のメッセージを表示する", () => {
    const store = createStore();
    store.set(dlsiteBulkErrorAtom, "一括取得の中止に失敗しました");

    renderGlobalToast(store);

    expect(screen.getByText("一括取得の中止に失敗しました")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "未設定項目を適用" })).toBeNull();
  });

  describe("DLsite一括取得完了トースト", () => {
    beforeEach(() => {
      HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      });
      HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.open = false;
      });
    });

    it("完了時に「未設定項目を適用」を押すと確認ダイアログが開く", () => {
      const store = createStore();
      store.set(dlsiteBulkResultAtom, sampleDlsiteResult);

      renderGlobalToast(store, true);

      expect(screen.getByText(/DLsite一括取得:/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "未設定項目を適用" }));
      expect(screen.getByRole("dialog", { name: "未設定項目をまとめて適用" })).toBeTruthy();
    });
  });

  it("dlsiteBulkCancelledResultAtom では「未設定項目を適用」を表示しない", () => {
    const store = createStore();
    store.set(dlsiteBulkCancelledResultAtom, sampleDlsiteResult);

    renderGlobalToast(store);

    expect(screen.getByText(/DLsite一括取得を中断しました/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "未設定項目を適用" })).toBeNull();
  });
});
