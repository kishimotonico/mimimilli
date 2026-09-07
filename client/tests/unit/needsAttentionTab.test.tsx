// 要対応タブ（TASK-428.4）: ID重複はworkId単位1行で全パスと解決導線を示す。
import { createElement } from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import NeedsAttentionTab from "../../src/features/scan/ui/scanModal/NeedsAttentionTab";
import * as scanApi from "../../src/features/scan/api";

function renderTab(overrides: Partial<Parameters<typeof NeedsAttentionTab>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = {
    identityConflicts: [],
    invalidMetaFiles: [],
    rjCodeMissingCount: 0,
    dlsiteFetchFailedCount: 0,
    dlsiteParseErrorCount: 0,
    dlsiteParseErrorAlert: false,
    dataIntegrityWarning: undefined,
    onOpenFiles: vi.fn(),
    onOpenNotificationModal: vi.fn(),
    ...overrides,
  };
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(NeedsAttentionTab, props),
    ),
  );
  return { props, queryClient };
}

describe("NeedsAttentionTab", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ID重複はworkId単位1行にまとめ、全パスを登録中/重複ラベル付きで表示する", () => {
    renderTab({
      identityConflicts: [
        { kind: "identity_conflict", workId: "RJ501001", paths: ["dlsite/a", "dlsite/b"] },
      ],
    });

    expect(screen.getAllByText("ID重複")).toHaveLength(1);
    expect(screen.getByText(/登録中:/)).toBeInTheDocument();
    expect(screen.getByText(/dlsite\/a/)).toBeInTheDocument();
    expect(screen.getByText(/重複:/)).toBeInTheDocument();
    expect(screen.getByText(/dlsite\/b/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "別作品として取り込む" })).toHaveLength(2);
  });

  it("「別作品として取り込む」は確認後にreassignIdentityConflictを呼び、診断を無効化する", async () => {
    const work = { id: "work-2" } as Work;
    const reassignSpy = vi.spyOn(scanApi, "reassignIdentityConflict").mockResolvedValue(work);

    const { queryClient } = renderTab({
      identityConflicts: [
        { kind: "identity_conflict", workId: "RJ501001", paths: ["dlsite/a", "dlsite/b"] },
      ],
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const [, secondReassignButton] = screen.getAllByRole("button", {
      name: "別作品として取り込む",
    });
    fireEvent.click(secondReassignButton!);

    const dialog = screen.getByRole("alertdialog", { name: "別作品として取り込む" });
    fireEvent.click(within(dialog).getByRole("button", { name: "取り込む" }));

    await waitFor(() => expect(reassignSpy).toHaveBeenCalledWith("dlsite/b"));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
  });

  it("読み取り失敗・データ不整合・行方不明以外の要対応が無ければ空状態を表示する", () => {
    renderTab();
    expect(screen.getByText("要対応の項目はありません。")).toBeInTheDocument();
  });
});
