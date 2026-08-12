import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DlsiteBulkApplyRuntime from "../../src/features/dlsite/ui/DlsiteBulkApplyRuntime";
import {
  dlsiteBulkApplyOpenAtom,
  dlsiteBulkApplyResultAtom,
  dlsiteInvalidateAtom,
} from "../../src/entities/dlsite/model/bulkAtoms";

const applyDlsiteMissing = vi.fn();

vi.mock("../../src/entities/work/api", () => ({
  applyDlsiteMissing: (...args: unknown[]) => applyDlsiteMissing(...args),
}));

function renderRuntime() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = createStore();
  store.set(dlsiteBulkApplyOpenAtom, true);
  store.set(
    dlsiteInvalidateAtom,
    vi.fn(async () => {}),
  );

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
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  it("適用で applyDlsiteMissing を引数なしで呼ぶ", async () => {
    applyDlsiteMissing.mockResolvedValue({ applied: 2, skipped: 1, failed: 0 });
    const store = renderRuntime();

    fireEvent.click(screen.getByRole("button", { name: "適用", exact: true }));

    await waitFor(() => expect(applyDlsiteMissing).toHaveBeenCalledWith());
    await waitFor(() =>
      expect(store.get(dlsiteBulkApplyResultAtom)).toBe(
        "未設定項目を適用: 適用 2件・スキップ 1件・失敗 0件",
      ),
    );
  });

  it("キャンセルでは applyDlsiteMissing を呼ばない", () => {
    renderRuntime();

    fireEvent.click(screen.getByRole("button", { name: "キャンセル", exact: true }));

    expect(applyDlsiteMissing).not.toHaveBeenCalled();
  });
});
