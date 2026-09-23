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

  it("フォルダー名からRJコードを検出できるときは保存を促す", () => {
    render(
      <WorkStatusWarnings
        work={makeWork({ physicalPath: "/lib/RJ123456_作品" })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenFiles={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "フォルダー名から RJ123456 を検出しました。DLsite連携で保存すると確定します",
      ),
    ).toBeInTheDocument();
  });

  it("フォルダー名から検出できないときは従来の未検出文面を出す", () => {
    render(
      <WorkStatusWarnings
        work={makeWork()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenFiles={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "フォルダー名からRJコードを自動検出できませんでした。RJコードを入力して取得するか、連携しない設定にできます。",
      ),
    ).toBeInTheDocument();
  });
});
