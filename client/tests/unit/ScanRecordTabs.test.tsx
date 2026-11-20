import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewWorksTab from "../../src/features/scan/ui/scanModal/newWorks/NewWorksTab";
import UpdatedWorksTab from "../../src/features/scan/ui/scanModal/updated/UpdatedWorksTab";
import { apiError, mockApi } from "../helpers/api";
import {
  buildScanRecord,
  buildSettings,
  buildWorkListItem,
  buildWorksPage,
} from "../helpers/builders";
import { clearResizeObservers } from "./setup";
import { mockUnregisteredListSize } from "../helpers/unregisteredListSize";

let restoreSize: () => void;
beforeEach(() => {
  restoreSize = mockUnregisteredListSize();
});

afterEach(() => {
  cleanup();
  clearResizeObservers();
  vi.restoreAllMocks();
  restoreSize();
});

function renderTab(tab: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{tab}</QueryClientProvider>);
}

/** 1回目だけ失敗し、2回目から成功する GET /works */
function worksFailingOnce() {
  let calls = 0;
  return () => {
    calls += 1;
    if (calls === 1) return apiError(500, "internal_error");
    return buildWorksPage([buildWorkListItem({ id: "w1", title: "取り直した作品" })]);
  };
}

describe("スキャン記録タブの読み込み失敗", () => {
  it("新規作品タブは読み込みに失敗したら再試行で一覧を出す", async () => {
    mockApi({
      "GET /api/settings": buildSettings(),
      "GET /api/scan/last": buildScanRecord({ finishedAt: "2026-01-01T00:00:00.000Z" }),
      "GET /api/works": worksFailingOnce(),
    });
    renderTab(<NewWorksTab onOpenFiles={vi.fn()} onOpenWorkDetail={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "再試行" }));

    expect(await screen.findByRole("table", { name: "新規作品" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
  });

  it("更新済みタブは読み込みに失敗したら再試行で一覧を出す", async () => {
    mockApi({
      "GET /api/scan/last": buildScanRecord({
        updatedWorks: [{ workId: "w1", changes: [{ kind: "meta" }] }],
      }),
      "GET /api/works": worksFailingOnce(),
    });
    renderTab(<UpdatedWorksTab onOpenFiles={vi.fn()} onOpenWorkDetail={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "再試行" }));

    expect(await screen.findByRole("table", { name: "更新済みの作品" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
  });
});
