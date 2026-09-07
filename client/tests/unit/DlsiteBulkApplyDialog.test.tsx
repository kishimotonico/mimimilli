import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DlsiteApplyMissingPreview } from "@mimimilli/shared";
import DlsiteBulkApplyRuntime from "../../src/features/dlsite/ui/DlsiteBulkApplyRuntime";
import {
  dlsiteBulkApplyOpenAtom,
  dlsiteBulkApplyResultAtom,
  dlsiteInvalidateAtom,
} from "../../src/entities/dlsite/model/bulkAtoms";

const applyDlsiteMissing = vi.fn();
const previewDlsiteMissing = vi.fn();

vi.mock("../../src/entities/work/api", () => ({
  applyDlsiteMissing: (...args: unknown[]) => applyDlsiteMissing(...args),
  previewDlsiteMissing: (...args: unknown[]) => previewDlsiteMissing(...args),
}));

const twoItemPreview: DlsiteApplyMissingPreview = {
  items: [
    { workId: "RJ501001", title: "作品A", newTags: ["cv/新CV"], applyCover: false, applyUrl: true },
    { workId: "RJ501002", title: "作品B", newTags: [], applyCover: true, applyUrl: false },
  ],
};

function renderRuntime() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = createStore();
  store.set(dlsiteBulkApplyOpenAtom, true);
  store.set(dlsiteInvalidateAtom, { run: vi.fn(async () => {}) });

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, createElement(DlsiteBulkApplyRuntime)),
    ),
  );

  return store;
}

describe("DlsiteBulkApplyDialog", () => {
  beforeEach(() => {
    applyDlsiteMissing.mockReset();
    previewDlsiteMissing.mockReset();
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  it("差分ありの対象を全選択した状態で開き、選択したworkIdだけをapplyDlsiteMissingへ渡す", async () => {
    previewDlsiteMissing.mockResolvedValue(twoItemPreview);
    applyDlsiteMissing.mockResolvedValue({ applied: 2, skipped: 0, failed: 0 });
    const store = renderRuntime();

    await waitFor(() => expect(screen.getByText("作品A")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "選択した2件に適用" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "選択した2件に適用" }));

    await waitFor(() => expect(applyDlsiteMissing).toHaveBeenCalledWith(["RJ501001", "RJ501002"]));
    await waitFor(() =>
      expect(store.get(dlsiteBulkApplyResultAtom)).toEqual({
        message: "未設定項目を適用: 適用 2件・スキップ 0件・失敗 0件",
        variant: "success",
      }),
    );
  });

  it("チェックを外した作品はapplyDlsiteMissingの引数から除かれる", async () => {
    previewDlsiteMissing.mockResolvedValue(twoItemPreview);
    applyDlsiteMissing.mockResolvedValue({ applied: 1, skipped: 0, failed: 0 });
    renderRuntime();

    await waitFor(() => expect(screen.getByText("作品B")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: "作品B" }));
    fireEvent.click(screen.getByRole("button", { name: "選択した1件に適用" }));

    await waitFor(() => expect(applyDlsiteMissing).toHaveBeenCalledWith(["RJ501001"]));
  });

  it("キャンセルでは applyDlsiteMissing を呼ばない", async () => {
    previewDlsiteMissing.mockResolvedValue(twoItemPreview);
    renderRuntime();

    await waitFor(() => expect(screen.getByText("作品A")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "キャンセル", exact: true }));

    expect(applyDlsiteMissing).not.toHaveBeenCalled();
  });

  it("差分0件では確認ダイアログを開かず結果をトーストで通知する", async () => {
    previewDlsiteMissing.mockResolvedValue({ items: [] } satisfies DlsiteApplyMissingPreview);
    const store = renderRuntime();

    await waitFor(() =>
      expect(store.get(dlsiteBulkApplyResultAtom)).toEqual({
        message: "DLsiteの情報は現在の内容と同じでした",
        variant: "info",
      }),
    );
    expect(screen.queryByRole("button", { name: /選択した/ })).not.toBeInTheDocument();
  });
});
