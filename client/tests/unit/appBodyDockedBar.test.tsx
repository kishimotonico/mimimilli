// 再生バーがドッキング表示中は、ライブラリの作品一覧の末尾に余白が増えてバーに隠れないことを
// AppBody → LibraryView → WorkListPane の実コンポーネントで確認する。
import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppBody from "../../src/app/AppBody";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { PlayerRuntimeProvider } from "../../src/entities/player/model/PlayerRuntimeProvider";
import { PLAYER_CORE_INITIAL, playerCoreAtom } from "../../src/entities/player/model/atoms";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { libraryViewModeAtom } from "../../src/features/library/model/atoms";
import { playerUiModeAtom } from "../../src/features/player/model/playerPresentationAtoms";
import { mockApi } from "../helpers/api";
import {
  buildDlsiteNotificationSummary,
  buildSettings,
  buildWorkListItem,
  buildWorksPage,
} from "../helpers/builders";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";

const WORK = buildWorkListItem({ id: "work-1", title: "作品 1" });

let sizeMock: { restore: () => void };

beforeEach(() => {
  sizeMock = mockElementSize(300, 600);
  mockApi({
    "GET /api/works": buildWorksPage([WORK]),
    "GET /api/settings": buildSettings({ rootFolder: "/root" }),
    "GET /api/tag-prefixes": [],
    "GET /api/smart-folders": [],
    "GET /api/tags": [],
    "GET /api/axes/:axis": [],
    "GET /api/works/missing-count": { count: 0 },
    "GET /api/dlsite/notifications": buildDlsiteNotificationSummary(),
  });
});

afterEach(() => {
  cleanup();
  sizeMock.restore();
  clearResizeObservers();
});

async function renderLibraryListHeight(store: ReturnType<typeof createStore>): Promise<number> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), buildSettings({ rootFolder: "/root" }));
  store.set(libraryViewModeAtom, "list");
  render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>
        <PlayerRuntimeProvider>
          <LibraryNavigationProvider>
            <AppBody onOpenWorkDetail={vi.fn()} />
          </LibraryNavigationProvider>
        </PlayerRuntimeProvider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
  const row = await screen.findByRole("button", { name: /作品 1/ });
  await act(async () => {
    flushAllResizeObservers({ width: 300, height: 600 });
  });
  const wrapper = row.closest(".mle-col__list")?.firstElementChild;
  if (!(wrapper instanceof HTMLElement)) throw new Error("virtualized wrapper not found");
  return Number.parseFloat(wrapper.style.height);
}

describe("AppBody: 再生バーのドッキング表示と作品一覧の末尾余白", () => {
  it("再生バーが表示されているとき、作品一覧の末尾余白が増える", async () => {
    const heightWithoutBar = await renderLibraryListHeight(createStore());
    cleanup();

    const store = createStore();
    store.set(playerCoreAtom, {
      ...PLAYER_CORE_INITIAL,
      currentTrackIndex: 0,
      currentWork: WORK,
    });
    store.set(playerUiModeAtom, "bar");
    const heightWithBar = await renderLibraryListHeight(store);

    expect(heightWithBar - heightWithoutBar).toBe(8);
  });
});
