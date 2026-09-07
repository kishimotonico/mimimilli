import { createElement, Fragment } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DlsiteBulkResult, ScanResult } from "@mimimilli/shared";
import GlobalToast from "../../src/app/ui/GlobalToast";
import DlsiteBulkApplyRuntime from "../../src/features/dlsite/ui/DlsiteBulkApplyRuntime";
import { errorToastAtom } from "../../src/shared/model/errorToastAtom";
import { playerSkipToastAtom } from "../../src/features/player/model/playerPresentationAtoms";
import { scanErrorAtom, scanResultToastAtom } from "../../src/entities/scan/model/atoms";
import { workDeleteSuccessAtom } from "../../src/features/library/model/atoms";
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
  onOpenScanNeedsAttention = vi.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const toast = createElement(GlobalToast, { onOpenScan, onOpenScanNeedsAttention });
  const children = withApplyRuntime
    ? createElement(Fragment, null, toast, createElement(DlsiteBulkApplyRuntime))
    : toast;

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

  it("workDeleteSuccessAtom のメッセージをsuccess variantで表示する", () => {
    const store = createStore();
    store.set(workDeleteSuccessAtom, "「作品X」の登録を解除しました");

    renderGlobalToast(store);

    expect(screen.getByText("「作品X」の登録を解除しました")).toBeTruthy();
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

  describe("スキャン完了・中止トースト（TASK-428.4）", () => {
    const baseResult: ScanResult = {
      registered: 12,
      insertedWorkIds: ["a", "b"],
      updatedWorkIds: [],
      errors: 0,
      missing: 0,
      rjCodeMissingCount: 0,
      skipped: 0,
      coverErrors: 0,
      identityConflicts: [],
      invalidMetaFiles: [],
      candidates: [],
    };

    it("要対応が無ければ登録・新規・エラー・欠損数だけを出し、アクションは付けない", () => {
      const store = createStore();
      store.set(scanResultToastAtom, { kind: "completed", result: baseResult });

      renderGlobalToast(store);

      expect(
        screen.getByText("スキャン完了: 登録 12件・新規 2件・エラー 0件・行方不明 0件"),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: "要対応を見る" })).toBeNull();
    });

    it("要対応があれば「要対応を見る」を出し、押すとコールバックとdismissが呼ばれる", () => {
      const store = createStore();
      const onOpenScanNeedsAttention = vi.fn();
      store.set(scanResultToastAtom, {
        kind: "completed",
        result: { ...baseResult, rjCodeMissingCount: 1 },
      });

      renderGlobalToast(store, false, vi.fn(), onOpenScanNeedsAttention);
      fireEvent.click(screen.getByRole("button", { name: "要対応を見る" }));

      expect(onOpenScanNeedsAttention).toHaveBeenCalledTimes(1);
      expect(store.get(scanResultToastAtom)).toBeNull();
    });

    it("中止時は「スキャンを中止しました」を出す", () => {
      const store = createStore();
      store.set(scanResultToastAtom, { kind: "cancelled" });

      renderGlobalToast(store);

      expect(screen.getByText("スキャンを中止しました")).toBeTruthy();
    });
  });
});
