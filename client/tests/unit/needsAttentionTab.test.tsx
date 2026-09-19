// 要対応タブ: ID重複はパスごとに1行、Filesで開く導線のみを示す。
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NeedsAttentionTab from "../../src/features/scan/ui/scanModal/NeedsAttentionTab";

function renderTab(overrides: Partial<Parameters<typeof NeedsAttentionTab>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();
  const props = {
    identityConflicts: [],
    invalidMetaFiles: [],
    rjCodeMissingCount: 0,
    dlsiteFetchFailedCount: 0,
    dlsiteParseErrorCount: 0,
    dlsiteParseErrorAlert: false,
    dataIntegrityWarning: undefined,
    onOpenFiles: vi.fn(),
    ...overrides,
  };
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, createElement(NeedsAttentionTab, props)),
    ),
  );
  return { props, queryClient, store };
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

  it("ID重複はパスごとに1行で表示し、Filesで開く導線を示す", () => {
    const onOpenFiles = vi.fn();
    renderTab({
      identityConflicts: [
        { kind: "identity_conflict", workId: "RJ501001", paths: ["dlsite/a", "dlsite/b"] },
      ],
      onOpenFiles,
    });

    expect(screen.getAllByText("ID重複")).toHaveLength(2);
    expect(screen.getByText("dlsite/a")).toBeInTheDocument();
    expect(screen.getByText(/workId: RJ501001/)).toBeInTheDocument();
    expect(screen.getByText("dlsite/b")).toBeInTheDocument();
    expect(screen.getByText("競合相手")).toBeInTheDocument();

    const openButtons = screen.getAllByRole("button", { name: "Filesで開く" });
    expect(openButtons).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "別作品として取り込む" })).not.toBeInTheDocument();

    openButtons[1]!.click();
    expect(onOpenFiles).toHaveBeenCalledWith("dlsite/b");
  });

  it("読み取り失敗・データ不整合・行方不明以外の要対応が無ければ空状態を表示する", () => {
    renderTab();
    expect(screen.getByText("要対応の項目はありません。")).toBeInTheDocument();
  });
});
