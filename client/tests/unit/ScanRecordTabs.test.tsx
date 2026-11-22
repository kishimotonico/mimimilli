import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewWorksTab from "../../src/features/scan/ui/scanModal/newWorks/NewWorksTab";
import UpdatedWorksTab from "../../src/features/scan/ui/scanModal/updated/UpdatedWorksTab";
import { workspacePath } from "@mimimilli/shared";
import { apiError, apiResponse, mockApi } from "../helpers/api";
import {
  buildScanRecord,
  buildSettings,
  buildWorkListItem,
  buildWorksPage,
} from "../helpers/builders";
import { clearResizeObservers } from "./setup";
import {
  flushUnregisteredListSize,
  mockUnregisteredListSize,
} from "../helpers/unregisteredListSize";

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
  render(<QueryClientProvider client={queryClient}>{tab}</QueryClientProvider>);
  return { queryClient };
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
      "GET /api/smart-folders/:id/works": worksFailingOnce(),
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
      "GET /api/smart-folders/:id/works": worksFailingOnce(),
    });
    renderTab(<UpdatedWorksTab onOpenFiles={vi.fn()} onOpenWorkDetail={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "再試行" }));

    expect(await screen.findByRole("table", { name: "更新済みの作品" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
  });
});

function pagedWorks(failFromPage: number) {
  const calls: number[] = [];
  const state = { hold: false };
  const handler = (request: { url: URL }) => {
    const page = Number(request.url.searchParams.get("page") ?? "1");
    calls.push(page);
    if (state.hold && page >= failFromPage) return new Promise<Response>(() => {});
    if (page >= failFromPage) return apiError(500, "internal_error");
    return buildWorksPage(
      Array.from({ length: 500 }, (_, index) =>
        buildWorkListItem({ id: `p${page}-${index}`, title: `作品${page}-${index}` }),
      ),
      { total: 501 },
    );
  };
  return { calls, handler, state };
}

async function scrollListToEnd(tableName: string) {
  const table = await screen.findByRole("table", { name: tableName });
  const list = table.querySelector<HTMLElement>(".overflow-y-auto");
  if (!list) throw new Error("scroll container not found");
  act(() => {
    list.scrollTop = 500 * 80;
    fireEvent.scroll(list);
  });
}

describe("スキャン記録タブの次ページ取得の失敗", () => {
  it("次ページの取得に失敗したら自動取得を止め、取得済みの行を残して末尾から再試行できる", async () => {
    const works = pagedWorks(2);
    mockApi({
      "GET /api/settings": buildSettings(),
      "GET /api/scan/last": buildScanRecord({ finishedAt: "2026-01-01T00:00:00.000Z" }),
      "GET /api/smart-folders/:id/works": works.handler,
    });
    renderTab(<NewWorksTab onOpenFiles={vi.fn()} onOpenWorkDetail={vi.fn()} />);
    await scrollListToEnd("新規作品");

    const retry = await screen.findByRole("button", { name: "再試行" });
    expect(screen.getByRole("table", { name: "新規作品" })).toBeInTheDocument();
    const failedCalls = works.calls.filter((page) => page === 2).length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      flushUnregisteredListSize();
    });
    expect(works.calls.filter((page) => page === 2)).toHaveLength(failedCalls);

    works.state.hold = true;
    await userEvent.click(retry);
    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
    await waitFor(() =>
      expect(works.calls.filter((page) => page === 2).length).toBeGreaterThan(failedCalls),
    );
  });
});

describe("更新済みタブの種類の切り替え", () => {
  it("切り替えた種類のデータが届くまで、前の条件の行を出さない", async () => {
    const pending = Promise.withResolvers<Response>();
    mockApi({
      "GET /api/scan/last": buildScanRecord({
        updatedWorks: [
          {
            workId: "w1",
            changes: [{ kind: "moved", from: workspacePath("旧/w1"), to: workspacePath("w1") }],
          },
          { workId: "w2", changes: [{ kind: "meta" }] },
        ],
      }),
      "GET /api/smart-folders/:id/works": (request) =>
        request.url.searchParams.get("scanChange") === "moved"
          ? pending.promise
          : buildWorksPage([
              buildWorkListItem({ id: "w1", title: "移動した作品" }),
              buildWorkListItem({ id: "w2", title: "メタだけ作品" }),
            ]),
    });
    renderTab(<UpdatedWorksTab onOpenFiles={vi.fn()} onOpenWorkDetail={vi.fn()} />);
    expect(await screen.findByText("メタだけ作品")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^移動\s*1$/ }));

    expect(screen.queryByText("メタだけ作品")).toBeNull();
    pending.resolve(
      apiResponse(buildWorksPage([buildWorkListItem({ id: "w1", title: "移動した作品" })])),
    );
    expect(await screen.findByText("移動した作品")).toBeInTheDocument();
  });
});

describe("更新済みタブの種類の解除", () => {
  it("件数が0になった種類の絞り込みは解除され、同じ種類が戻っても効き直さない", async () => {
    let record = buildScanRecord({
      updatedWorks: [
        {
          workId: "w1",
          changes: [{ kind: "moved", from: workspacePath("旧/w1"), to: workspacePath("w1") }],
        },
        { workId: "w2", changes: [{ kind: "meta" }] },
      ],
    });
    const moved = buildScanRecord({ updatedWorks: record.updatedWorks });
    mockApi({
      "GET /api/scan/last": () => record,
      "GET /api/smart-folders/:id/works": () =>
        buildWorksPage([
          buildWorkListItem({ id: "w1", title: "移動した作品" }),
          buildWorkListItem({ id: "w2", title: "メタだけ作品" }),
        ]),
    });
    const { queryClient } = renderTab(
      <UpdatedWorksTab onOpenFiles={vi.fn()} onOpenWorkDetail={vi.fn()} />,
    );
    await screen.findByText("メタだけ作品");
    await userEvent.click(screen.getByRole("button", { name: /^移動\s*1$/ }));
    expect(screen.getByRole("button", { name: /^移動\s*1$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    record = buildScanRecord({ updatedWorks: [moved.updatedWorks[1]!] });
    await act(() => queryClient.invalidateQueries({ queryKey: ["scan", "last"] }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^すべて/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );

    record = moved;
    await act(() => queryClient.invalidateQueries({ queryKey: ["scan", "last"] }));
    const chip = await screen.findByRole("button", { name: /^移動\s*1$/ });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^すべて/ })).toHaveAttribute("aria-pressed", "true");
  });
});
