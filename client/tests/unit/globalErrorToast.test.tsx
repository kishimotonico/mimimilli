import { createElement, Fragment } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DlsiteBulkResult } from "@mimimilli/shared";
import GlobalToast from "../../src/app/ui/GlobalToast";
import DlsiteBulkApplyRuntime from "../../src/features/dlsite/ui/DlsiteBulkApplyRuntime";
import { errorToastAtom } from "../../src/shared/model/errorToastAtom";
import { playerSkipToastAtom } from "../../src/features/player/model/playerPresentationAtoms";
import { scanErrorAtom } from "../../src/entities/scan/model/atoms";
import {
  dlsiteBulkCancelledResultAtom,
  dlsiteBulkErrorAtom,
  dlsiteBulkResultAtom,
} from "../../src/entities/dlsite/model/bulkAtoms";
import { rootFolderChangedToastAtom } from "../../src/entities/settings/model/rootFolderChangeAtoms";

const sampleDlsiteResult: DlsiteBulkResult = {
  fetched: 2,
  failed: 0,
  parseErrors: 0,
  skipped: 0,
};

function renderGlobalToast(
  store: ReturnType<typeof createStore>,
  withApplyRuntime = false,
  onOpenScan = vi.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const children = withApplyRuntime
    ? createElement(
        Fragment,
        null,
        createElement(GlobalToast, { onOpenScan }),
        createElement(DlsiteBulkApplyRuntime),
      )
    : createElement(GlobalToast, { onOpenScan });

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

  it("playerSkipToastAtom のメッセージを表示する", () => {
    const store = createStore();
    store.set(playerSkipToastAtom, "「Track 1」をスキップしました");

    renderGlobalToast(store);

    expect(screen.getByText("「Track 1」をスキップしました")).toBeTruthy();
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

  it("rootFolderChangedToastAtom がtrueのとき「今すぐスキャン」でonOpenScanを呼ぶ", () => {
    const store = createStore();
    store.set(rootFolderChangedToastAtom, true);
    const onOpenScan = vi.fn();

    renderGlobalToast(store, false, onOpenScan);

    expect(
      screen.getByText(
        "ルートフォルダーを変更しました。新しいフォルダーを読み込むにはスキャンしてください。",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "今すぐスキャン" }));
    expect(onOpenScan).toHaveBeenCalledTimes(1);
  });

  it("dlsiteBulkCancelledResultAtom では「未設定項目を適用」を表示しない", () => {
    const store = createStore();
    store.set(dlsiteBulkCancelledResultAtom, sampleDlsiteResult);

    renderGlobalToast(store);

    expect(screen.getByText(/DLsite一括取得を中断しました/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "未設定項目を適用" })).toBeNull();
  });
});
