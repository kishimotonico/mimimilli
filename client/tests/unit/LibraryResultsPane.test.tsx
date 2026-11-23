import { createElement } from "react";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { isHasErrorOnly } from "@mimimilli/shared";
import LibraryResultsPane from "../../src/features/library/ui/LibraryResultsPane";
import { mockApi } from "../helpers/api";
import { buildScanDiagnostics, buildWorkListItem } from "../helpers/builders";
import { buildNav } from "./fixtures/libraryNav";

vi.mock("../../src/entities/player/model/usePlayWork", () => ({
  usePlayWork: () => ({ playWork: vi.fn(), resumeWork: vi.fn() }),
}));

const BANNER = "1件の作品がデータ不整合のため除外されました";

function renderPane(folderId: string) {
  const api = mockApi({
    "GET /api/scan/diagnostics": buildScanDiagnostics({
      dataIntegrityWorks: [{ workId: "a", title: null }],
    }),
    "GET /api/works/missing-count": { total: 0 },
  });
  const nav = buildNav({ library: { folderId } });
  render(
    createElement(
      QueryClientProvider,
      { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
      createElement(LibraryResultsPane, {
        nav,
        result: {
          works: [buildWorkListItem({ id: "w1", title: "作品" })],
          hasNextPage: false,
          worksTotal: 1,
          worksStats: { trackCount: 0, durationSec: 0 },
          isFetchingNextPage: false,
          fetchNextPage: vi.fn(),
          refetchWorks: vi.fn(),
        },
        worksQueryKey: "k",
        isPending: false,
        showGrid: false,
        dockedBarActive: false,
        isErrorRow: isHasErrorOnly(
          (nav.view as Extract<typeof nav.view, { kind: "works" }>).condition,
        ),
        missingWorksCount: 0,
        tagSuggestions: [],
        searchQuery: "",
        onClearSearch: vi.fn(),
        selectedWork: null,
        workDetailQuery: { isPending: false, isError: false, refetch: vi.fn() } as never,
        previewActions: {} as never,
        onTagClick: vi.fn(),
      }),
    ),
  );
  return api;
}

describe("LibraryResultsPane のデータ不整合バナー", () => {
  it("条件が hasError だけのスマートフォルダーでは出す", async () => {
    renderPane("error");
    expect(await screen.findByText(BANNER)).toBeInTheDocument();
  });

  it("それ以外のスマートフォルダーでは出さない", async () => {
    const api = renderPane("all");
    // 診断が取得できる状況でも出ないこと（取得自体は他の画面でも行われうる）
    await vi.waitFor(() => expect(api.requestsTo("GET /api/scan/diagnostics").length).toBe(0));
    await act(async () => {});
    expect(screen.queryByText(BANNER)).not.toBeInTheDocument();
  });
});
