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
  it("missing状態では登録解除・Filesで開くボタンを表示し、それぞれonDelete・onOpenFilesを呼ぶ", () => {
    const onDelete = vi.fn();
    const onOpenFiles = vi.fn();
    render(
      <WorkStatusWarnings
        work={makeWork({ status: "missing" })}
        onEdit={vi.fn()}
        onDelete={onDelete}
        onOpenFiles={onOpenFiles}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "登録を解除" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Filesで開く" }));
    expect(onOpenFiles).toHaveBeenCalledTimes(1);
  });

  it("error状態でも登録解除・Filesで開くボタンを表示する（missingと導線を統一）", () => {
    const onDelete = vi.fn();
    const onOpenFiles = vi.fn();
    render(
      <WorkStatusWarnings
        work={makeWork({ status: "error", errorMessage: "boom" })}
        onEdit={vi.fn()}
        onDelete={onDelete}
        onOpenFiles={onOpenFiles}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "登録を解除" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Filesで開く" }));
    expect(onOpenFiles).toHaveBeenCalledTimes(1);
  });
});
