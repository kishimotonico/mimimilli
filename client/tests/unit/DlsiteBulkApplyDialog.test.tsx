import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DlsiteBulkApplyRuntime from "../../src/features/dlsite/ui/DlsiteBulkApplyRuntime";
import { dlsiteBulkApplyOpenAtom } from "../../src/entities/dlsite/model/bulkAtoms";
import { toastRequestsAtom } from "../../src/shared/model/toastRequestsAtom";
import { mockApi, type ApiMock } from "../helpers/api";
import {
  buildDlsiteApplyMissingPreview,
  buildDlsiteBulkApplyMissingResult,
} from "../helpers/builders";

/** DlsiteBulkApplyRuntimeは単一のuseToast()しか持たないため、要求は高々1件 */
function latestToastRequest(store: ReturnType<typeof createStore>) {
  return [...store.get(toastRequestsAtom).values()][0];
}

const twoItemPreview = buildDlsiteApplyMissingPreview([
  { workId: "RJ501001", title: "作品A", newTags: ["cv/新CV"], applyCover: false, applyUrl: true },
  { workId: "RJ501002", title: "作品B", newTags: [], applyCover: true, applyUrl: false },
]);

let api: ApiMock;

function mockDlsiteMissingApi(
  preview: ReturnType<typeof buildDlsiteApplyMissingPreview>,
  applied = buildDlsiteBulkApplyMissingResult(),
) {
  api = mockApi({
    "POST /api/dlsite/apply-missing/preview": preview,
    "POST /api/dlsite/apply-missing": applied,
  });
}

function appliedWorkIds(): unknown[] {
  return api.requestsTo("POST /api/dlsite/apply-missing").map((request) => request.body);
}

function renderRuntime() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = createStore();
  store.set(dlsiteBulkApplyOpenAtom, true);

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
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  it("差分ありの対象を全選択した状態で開き、選択したworkIdだけを適用リクエストに送る", async () => {
    mockDlsiteMissingApi(twoItemPreview, buildDlsiteBulkApplyMissingResult({ applied: 2 }));
    const store = renderRuntime();

    await waitFor(() => expect(screen.getByText("作品A")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "選択した2件に適用" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "選択した2件に適用" }));

    await waitFor(() => expect(appliedWorkIds()).toEqual([{ workIds: ["RJ501001", "RJ501002"] }]));
    await waitFor(() =>
      expect(latestToastRequest(store)?.message).toBe(
        "未設定項目を適用: 適用 2件・未反映 0件・スキップ 0件・失敗 0件",
      ),
    );
    expect(latestToastRequest(store)?.variant).toBe("success");
  });

  it("チェックを外した作品は適用リクエストから除かれる", async () => {
    mockDlsiteMissingApi(twoItemPreview, buildDlsiteBulkApplyMissingResult({ applied: 1 }));
    renderRuntime();

    await waitFor(() => expect(screen.getByText("作品B")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: "作品B" }));
    fireEvent.click(screen.getByRole("button", { name: "選択した1件に適用" }));

    await waitFor(() => expect(appliedWorkIds()).toEqual([{ workIds: ["RJ501001"] }]));
  });

  it("キャンセルでは適用リクエストを送らない", async () => {
    mockDlsiteMissingApi(twoItemPreview);
    renderRuntime();

    await waitFor(() => expect(screen.getByText("作品A")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "キャンセル", exact: true }));

    expect(appliedWorkIds()).toHaveLength(0);
  });

  it("差分0件では確認ダイアログを開かず結果をトーストで通知する", async () => {
    mockDlsiteMissingApi(buildDlsiteApplyMissingPreview());
    const store = renderRuntime();

    await waitFor(() =>
      expect(latestToastRequest(store)?.message).toBe("DLsiteの情報は現在の内容と同じでした"),
    );
    expect(latestToastRequest(store)?.variant).toBe("info");
    expect(screen.queryByRole("button", { name: /選択した/ })).not.toBeInTheDocument();
  });
});
