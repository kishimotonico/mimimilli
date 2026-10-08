import { createElement, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";
import { WorkDetailPatchScope } from "../../src/features/library/ui/preview/WorkDetailPatchScope";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { apiResponse, mockApi } from "../helpers/api";
import {
  buildResolvedPlaylist,
  buildSettings,
  buildWork,
  buildWorkEditSnapshotOf,
  buildWorkSourceMutationResult,
} from "../helpers/builders";

vi.mock("../../src/entities/player/model/usePlayWork", () => ({
  usePlayWork: () => ({ playWork: vi.fn(), resumeWork: vi.fn() }),
}));
vi.mock("../../src/entities/player/model/usePlayerActions", () => ({
  usePlayerActions: () => ({ playFile: vi.fn(), togglePlay: vi.fn() }),
}));

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

function makeWork(id: string): Work {
  const playlist = buildResolvedPlaylist(1, ["track"]);
  return buildWork({
    id,
    title: `作品 ${id}`,
    physicalPath: `/lib/${id}`,
    totalDurationSec: 60,
    defaultPlaylistId: playlist.id,
    playlists: [playlist],
  });
}

function renderScopedDetail(workId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), buildSettings({ rootFolder: "/lib" }));
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return render(
    <WorkDetailPatchScope
      key={workId}
      work={makeWork(workId)}
      nav={{ ...baseNav, selectedWorkId: workId }}
      searchQuery=""
      playingTrackIndex={null}
      tagSuggestions={[]}
      onTagClick={vi.fn()}
    />,
    { wrapper },
  );
}

describe("WorkDetailPatchScope", () => {
  let titlePatchReply: (body: { title?: string }) => Promise<Response> | Response;

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    titlePatchReply = () =>
      apiResponse(
        buildWorkSourceMutationResult(buildWorkEditSnapshotOf(makeWork("work-a"), "revision-2")),
      );
    mockApi({
      "PATCH /api/works/:id/bookmark": ({ params }) =>
        params.id === "work-a"
          ? new Response(JSON.stringify({ error: "server error" }), { status: 500 })
          : { bookmarked: true },
      "GET /api/works/:id/source": ({ params }) =>
        buildWorkEditSnapshotOf(makeWork(params.id!), "revision-1"),
      "PATCH /api/works/:id": ({ body }) => titlePatchReply(body as { title?: string }),
      "GET /api/works/:id": ({ params }) => makeWork(params.id!),
      "GET /api/settings": buildSettings({ rootFolder: "/lib" }),
      "GET /api/tag-prefixes": [],
    });
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
    titlePatchReply = () =>
      new Promise<Response>((resolve) => {
        resolvePatch = resolve;
      });

    renderScopedDetail("work-a");

    fireEvent.click(screen.getByRole("button", { name: "作品を編集" }));
    const titleInput = await screen.findByLabelText("タイトル");
    await waitFor(() => expect(titleInput).not.toBeDisabled());
    fireEvent.change(titleInput, { target: { value: "新しいタイトル" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "ブックマークに追加" })).not.toBeDisabled();

    await act(async () => {
      resolvePatch?.(
        apiResponse(
          buildWorkSourceMutationResult(
            buildWorkEditSnapshotOf(
              { ...makeWork("work-a"), title: "新しいタイトル" },
              "revision-2",
            ),
          ),
        ),
      );
    });
  });
});
