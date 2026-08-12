import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FsEntry } from "@mimimilli/shared";
import FileColumn from "../../src/features/files/ui/FileColumn";

afterEach(cleanup);

function makeEntry(overrides: Partial<FsEntry> = {}): FsEntry {
  return {
    name: "track01.mp3",
    path: "/root/track01.mp3",
    isDir: false,
    size: 1000,
    fileType: "mp3",
    childCount: 0,
    workId: null,
    workRelPath: null,
    mediaKind: "audio",
    preview: { kind: "available" },
    ...overrides,
  };
}

function renderColumn(props: Partial<React.ComponentProps<typeof FileColumn>> = {}) {
  return render(
    <FileColumn
      title="フォルダー"
      entries={[]}
      selectedPath={null}
      matchPlaying={() => false}
      onOpenDir={vi.fn()}
      onSelectFile={vi.fn()}
      onPlayFile={vi.fn()}
      {...props}
    />,
  );
}

describe("FileColumn", () => {
  it("isLoading 中は共通の読み込みスケルトンを role=status で表示する", () => {
    renderColumn({ isLoading: true });
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中...");
  });

  it("isError のとき空フォルダーと区別してエラーを表示する", () => {
    renderColumn({ isError: true, entries: [] });
    expect(screen.getByRole("status")).toHaveTextContent("読み込みに失敗しました");
    expect(screen.queryByText("空のフォルダー")).toBeNull();
  });

  it("isError かつ onRetry があれば再試行ボタンをクリックで呼べる", async () => {
    const onRetry = vi.fn();
    renderColumn({ isError: true, onRetry });
    await userEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("entriesのキャッシュがあるisErrorは一覧をブロックせず非ブロッキングのエラー行を出す", () => {
    renderColumn({ isError: true, entries: [makeEntry({ name: "cached.mp3" })] });

    expect(screen.getByText("フォルダー一覧の取得に失敗しました")).toBeTruthy();
    expect(screen.getByText("cached.mp3")).toBeTruthy();
    // 一覧全体を差し替える固定文言のCollectionStatus(kind="error")は出ない
    expect(screen.queryByText("読み込みに失敗しました")).toBeNull();
  });

  it("0件のときは空のフォルダーと案内する", () => {
    renderColumn({ entries: [] });
    expect(screen.getByText("空のフォルダー")).toBeTruthy();
  });

  it("エントリがあれば行を描画する", () => {
    renderColumn({ entries: [makeEntry({ name: "a.mp3" }), makeEntry({ name: "b.mp3" })] });
    expect(screen.getByText("a.mp3")).toBeTruthy();
    expect(screen.getByText("b.mp3")).toBeTruthy();
  });
});
