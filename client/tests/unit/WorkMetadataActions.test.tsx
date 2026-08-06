import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import type { LibraryBookmarkPatchMutation } from "../../src/features/library/model/workPatchMutations";
import { WorkMetadataActions } from "../../src/features/library/ui/preview/WorkMetadataActions";

function makeWork(): Work {
  return {
    id: "w1",
    title: "作品",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/lib/w1",
    totalDurationSec: 120,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: null,
    createdAt: null,
    playlists: [],
    resume: null,
  };
}

function makeBookmarkMutation(
  overrides: Partial<LibraryBookmarkPatchMutation> = {},
): LibraryBookmarkPatchMutation {
  return {
    isPending: false,
    error: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    ...overrides,
  } as LibraryBookmarkPatchMutation;
}

describe("WorkMetadataActions", () => {
  it("ブックマーク更新失敗時に mutation.error をインライン表示する", () => {
    render(
      <WorkMetadataActions
        work={makeWork()}
        bookmarkMutation={makeBookmarkMutation({
          error: new Error("network error"),
        })}
        onEdit={vi.fn()}
        onShowInfo={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("ブックマークを更新できませんでした。");
  });

  it("ブックマーク切替で mutation.mutate を呼ぶ", () => {
    const mutate = vi.fn();
    render(
      <WorkMetadataActions
        work={makeWork()}
        bookmarkMutation={makeBookmarkMutation({ mutate })}
        onEdit={vi.fn()}
        onShowInfo={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ブックマークに追加" }));
    expect(mutate).toHaveBeenCalledWith({ workId: "w1", bookmarked: true });
  });
});
