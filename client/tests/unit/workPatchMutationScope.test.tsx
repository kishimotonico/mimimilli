import { createElement, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDlsiteState, type Work } from "@mimimilli/shared";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";
import { WorkDetailPatchScope } from "../../src/features/library/ui/preview/WorkDetailPatchScope";

vi.mock("../../src/features/library/ui/preview/WorkTagEditor", () => ({
  WorkTagEditor: () => <div data-testid="tag-editor" />,
}));
vi.mock("../../src/features/library/ui/preview/WorkTrackList", () => ({
  WorkTrackList: () => <div data-testid="track-list" />,
}));
vi.mock("../../src/features/library/ui/preview/WorkStatusWarnings", () => ({
  WorkStatusWarnings: () => null,
}));

const baseNav: LibraryViewState = {
  activeAxis: "all",
  selectedTags: [],
  selectedWorkId: "work-a",
  sort: "added-desc",
};

const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeWork(id: string): Work {
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: `/lib/${id}`,
    totalDurationSec: 60,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            title: "track",
            file: "track.mp3",
            durationSec: 60,
            durationKind: "resolved",
          },
        ],
      },
    ],
    resume: null,
  };
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderScopedDetail(workId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return render(
    <WorkDetailPatchScope
      key={workId}
      work={makeWork(workId)}
      nav={{ ...baseNav, selectedWorkId: workId }}
      searchQuery=""
      onPlay={vi.fn()}
      onResume={vi.fn()}
      onTogglePlay={vi.fn()}
      playingTrackIndex={null}
      tagSuggestions={[]}
      onTagClick={vi.fn()}
    />,
    { wrapper },
  );
}

describe("WorkDetailPatchScope", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input.toString(), "http://localhost");
      const workId = url.pathname.match(/^\/api\/works\/([^/]+)$/)?.[1];
      if (workId && init?.method === "PATCH") {
        if (workId === "work-a") {
          return Promise.resolve(
            new Response(JSON.stringify({ error: "server error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        const body = JSON.parse(init.body as string) as { bookmarked?: boolean };
        return Promise.resolve(
          jsonResponse({ ...makeWork(workId), bookmarked: body.bookmarked ?? false }),
        );
      }
      if (workId) {
        return Promise.resolve(jsonResponse(makeWork(workId)));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url.toString()}`));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("作品 A で失敗した mutation 状態が作品 B に持ち越されない", async () => {
    const { rerender } = renderScopedDetail("work-a");

    fireEvent.click(screen.getByRole("button", { name: "ブックマークに追加" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("ブックマークを更新できませんでした。");
    });

    rerender(
      <WorkDetailPatchScope
        key="work-b"
        work={makeWork("work-b")}
        nav={{ ...baseNav, selectedWorkId: "work-b" }}
        searchQuery=""
        onPlay={vi.fn()}
        onResume={vi.fn()}
        onTogglePlay={vi.fn()}
        playingTrackIndex={null}
        tagSuggestions={[]}
        onTagClick={vi.fn()}
      />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "ブックマークに追加" })).not.toBeDisabled();
  });

  it("タイトル mutation の失敗がブックマーク操作の pending 状態に影響しない", async () => {
    let resolvePatch: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input.toString(), "http://localhost");
      const workId = url.pathname.match(/^\/api\/works\/([^/]+)$/)?.[1];
      if (workId && init?.method === "PATCH") {
        const body = JSON.parse(init.body as string) as { title?: string; bookmarked?: boolean };
        if (body.title !== undefined) {
          return new Promise<Response>((resolve) => {
            resolvePatch = resolve;
          });
        }
        return Promise.resolve(
          jsonResponse({ ...makeWork(workId), bookmarked: body.bookmarked ?? false }),
        );
      }
      if (workId) return Promise.resolve(jsonResponse(makeWork(workId)));
      return Promise.reject(new Error(`unexpected fetch: ${url.toString()}`));
    });

    renderScopedDetail("work-a");

    fireEvent.click(screen.getByRole("button", { name: "作品を編集" }));
    const titleInput = await screen.findByLabelText("タイトル");
    fireEvent.change(titleInput, { target: { value: "新しいタイトル" } });
    fireEvent.click(screen.getByRole("button", { name: "タイトルを保存" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "タイトルを保存" })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "ブックマークに追加" })).not.toBeDisabled();

    await act(async () => {
      resolvePatch?.(jsonResponse({ ...makeWork("work-a"), title: "新しいタイトル" }));
    });
  });
});
