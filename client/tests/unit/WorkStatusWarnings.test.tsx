import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import { WorkStatusWarnings } from "../../src/features/library/ui/preview/WorkStatusWarnings";

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

describe("WorkStatusWarnings", () => {
  it("missing状態では登録解除ボタンを表示しonDeleteを呼ぶ", () => {
    const onDelete = vi.fn();
    render(
      <WorkStatusWarnings
        work={makeWork({ status: "missing" })}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    );

    const button = screen.getByRole("button", { name: "登録を解除" });
    fireEvent.click(button);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("error状態では登録解除ボタンを表示しない", () => {
    render(
      <WorkStatusWarnings
        work={makeWork({ status: "error", errorMessage: "boom" })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "登録を解除" })).toBeNull();
  });
});
