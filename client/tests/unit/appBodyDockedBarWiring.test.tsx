// AppBody → LibraryView → WorkGrid/WorkListPane の dockedBarActive 配線を検証する。
// entities/player の playerIsActiveAtom・playerUiModeAtom から
// features/player の playerDockBarVisibleAtom を経て、AppBody が計算した値が
// 末端の結果面コンポーネントまで props で届くことを見る（TASK-368）。
// LibraryView自体の作品一覧取得・軸集計等は本題ではないため、重いhookはまとめて
// モックし、実データ取得は行わない。

import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import AppBody from "../../src/app/AppBody";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { PLAYER_CORE_INITIAL, playerCoreAtom } from "../../src/entities/player/model/atoms";
import { playerUiModeAtom } from "../../src/features/player/model/playerPresentationAtoms";
import type { WorkListItem } from "@mimimilli/shared";

vi.mock("../../src/entities/settings/useSettingsQuery", () => ({
  useRootFolder: () => "/root",
}));

const fakeWorksResult = {
  works: [] as WorkListItem[],
  worksParams: {},
  hasNextPage: false,
  worksTotal: 0,
  worksStats: undefined,
  dataIntegrityWarning: undefined,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetchWorks: vi.fn(),
};

vi.mock("../../src/features/library/model/useLibraryQueries", () => ({
  useSuspenseNormalLibraryWorks: () => fakeWorksResult,
  useSuspenseSmartLibraryWorks: () => fakeWorksResult,
  useLibraryDebouncedSearchQuery: (q: string) => q,
  useLibrarySupportingQueries: () => ({
    errorViewCount: undefined,
    libraryStats: { status: "loading" },
    facetItems: [],
    isFacetLoading: false,
    isFacetError: false,
    refetchFacets: vi.fn(),
    smartFolders: [],
    selectedWork: null,
    workDetailQuery: { data: null, error: null, isPending: false },
    tagSuggestions: [],
    tagPrefixes: [],
    isTagPrefixesError: false,
    refetchTagPrefixes: vi.fn(),
  }),
  useMissingWorksCountQuery: () => ({ data: undefined }),
  useLibraryBulkUnregisterMissingMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useSmartFolderMutation: () => ({ isPending: false, reset: vi.fn(), mutate: vi.fn() }),
}));

vi.mock("../../src/features/library/ui/WorkGrid", () => ({
  default: ({ dockedBarActive }: { dockedBarActive?: boolean }) => (
    <div data-testid="work-grid" data-docked-bar-active={String(dockedBarActive ?? false)} />
  ),
}));

vi.mock("../../src/features/library/ui/WorkListPane", () => ({
  default: ({ dockedBarActive }: { dockedBarActive?: boolean }) => (
    <div data-testid="work-list-pane" data-docked-bar-active={String(dockedBarActive ?? false)} />
  ),
}));

function renderAppBody(store: ReturnType<typeof createStore>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>
        <LibraryNavigationProvider>
          <AppBody
            rootFolder="/root"
            onPlay={vi.fn()}
            onResume={vi.fn()}
            onTogglePlay={vi.fn()}
            onPlayFile={vi.fn()}
            onOpenWorkDetail={vi.fn()}
          />
        </LibraryNavigationProvider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
}

describe("AppBody: dockedBarActiveがLibraryView配下まで届く配線", () => {
  it("再生中でない（playerDockBarVisibleAtom=false）ときはfalseが届く", () => {
    const { getByTestId } = renderAppBody(createStore());
    expect(getByTestId("work-list-pane")).toHaveAttribute("data-docked-bar-active", "false");
  });

  it("bar表示中の再生がある（playerDockBarVisibleAtom=true）ときはtrueが末端まで届く", () => {
    const store = createStore();
    store.set(playerCoreAtom, {
      ...PLAYER_CORE_INITIAL,
      currentTrackIndex: 0,
      currentWork: {
        id: "work-1",
        title: "Work 1",
        cover: null,
        status: "ok",
        totalDurationSec: 0,
        trackCount: 0,
        bookmarked: false,
        lastPlayedAt: null,
        circleName: null,
      },
    });
    store.set(playerUiModeAtom, "bar");

    const { getByTestId } = renderAppBody(store);
    expect(getByTestId("work-list-pane")).toHaveAttribute("data-docked-bar-active", "true");
  });
});
