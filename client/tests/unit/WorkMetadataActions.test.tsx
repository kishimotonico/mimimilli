import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import type { BookmarkWorkMutation } from "../../src/entities/work/model/workMutations";
import { WorkMetadataActions } from "../../src/features/library/ui/preview/WorkMetadataActions";

function makeWork(overrides: Partial<Work> = {}): Work {
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
    sourceRevision: "revision-1",
    ...overrides,
  };
}

function makeBookmarkMutation(overrides: Partial<BookmarkWorkMutation> = {}): BookmarkWorkMutation {
  return {
    isPending: false,
    error: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    ...overrides,
  } as BookmarkWorkMutation;
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
        onDelete={vi.fn()}
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
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ブックマークに追加" }));
    expect(mutate).toHaveBeenCalledWith({
      workId: "w1",
      bookmarked: true,
    });
  });

  it("その他メニューから作品登録を解除を選ぶと onDelete を呼ぶ", () => {
    const onDelete = vi.fn();
    render(
      <WorkMetadataActions
        work={makeWork()}
        bookmarkMutation={makeBookmarkMutation()}
        onEdit={vi.fn()}
        onShowInfo={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "作品登録を解除" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("http(s)の外部リンクはメニューでhref付きリンクとして表示する", () => {
    render(
      <WorkMetadataActions
        work={makeWork({
          urls: [{ label: "DLsite", url: "https://www.dlsite.com/work/123" }],
        })}
        bookmarkMutation={makeBookmarkMutation()}
        onEdit={vi.fn()}
        onShowInfo={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    const link = screen.getByRole("menuitem", { name: "DLsiteを開く" });
    expect(link).toHaveAttribute("href", "https://www.dlsite.com/work/123");
  });

  it("危険スキームの外部リンクはメニューでリンク化しない", () => {
    render(
      <WorkMetadataActions
        work={makeWork({
          urls: [{ label: "Evil", url: "javascript:alert(1)" }],
        })}
        bookmarkMutation={makeBookmarkMutation()}
        onEdit={vi.fn()}
        onShowInfo={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    const item = screen.getByRole("menuitem", { name: "Evilを開く" });
    expect(item).not.toHaveAttribute("href");
    expect(item).toHaveAttribute("aria-disabled", "true");
  });
});
