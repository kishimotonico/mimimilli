import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FsEntry, WorkspacePath } from "@mimimilli/shared";
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
      identityConflictPaths={new Map()}
      selectedPath={null}
      matchPlaying={() => false}
      onOpenDir={vi.fn()}
      onSelectFile={vi.fn()}
      onFocusEntry={vi.fn()}
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

  it("notFound は再試行ボタンを出さず「見つかりません」と案内する（404はisErrorと区別）", () => {
    renderColumn({ isError: true, notFound: true, entries: [] });
    expect(screen.getByText("このフォルダーは見つかりません")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
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

describe("FileColumn の矢印キー・roving tabindex", () => {
  it("ArrowDown/Home/Endが作品一覧と同じ規則で動き、フォーカス移動先でonFocusEntryを呼ぶ", async () => {
    const user = userEvent.setup();
    const onFocusEntry = vi.fn();
    renderColumn({
      entries: [
        makeEntry({ name: "a.mp3", path: "root/a.mp3" as WorkspacePath }),
        makeEntry({ name: "b.mp3", path: "root/b.mp3" as WorkspacePath }),
        makeEntry({ name: "c.mp3", path: "root/c.mp3" as WorkspacePath }),
      ],
      onFocusEntry,
    });

    const rows = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".mle-row"));
    rows()[0]!.focus();
    expect(document.activeElement).toBe(rows()[0]);

    await user.keyboard("{ArrowDown}");
    expect(onFocusEntry).toHaveBeenLastCalledWith("root/b.mp3");

    await user.keyboard("{End}");
    expect(onFocusEntry).toHaveBeenLastCalledWith("root/c.mp3");

    await user.keyboard("{Home}");
    expect(onFocusEntry).toHaveBeenLastCalledWith("root/a.mp3");

    // 端でのArrowUpはラップアラウンドせずクランプする（作品一覧と同じ規則）。
    onFocusEntry.mockClear();
    await user.keyboard("{ArrowUp}");
    expect(onFocusEntry).not.toHaveBeenCalled();
  });

  it("roving tabindex: 選択中エントリの行だけがtabIndex 0になる（無選択なら先頭）", () => {
    renderColumn({
      entries: [
        makeEntry({ name: "a.mp3", path: "root/a.mp3" as WorkspacePath }),
        makeEntry({ name: "b.mp3", path: "root/b.mp3" as WorkspacePath }),
        makeEntry({ name: "c.mp3", path: "root/c.mp3" as WorkspacePath }),
      ],
      selectedPath: "root/b.mp3" as WorkspacePath,
    });

    const rows = Array.from(document.querySelectorAll<HTMLButtonElement>(".mle-row"));
    const tabbable = rows.filter((el) => el.tabIndex === 0);
    expect(tabbable.length).toBe(1);
    expect(tabbable[0]?.textContent).toContain("b.mp3");
  });

  it("roving tabindex: 未選択のときは先頭行がtabIndex 0になる", () => {
    renderColumn({
      entries: [
        makeEntry({ name: "a.mp3", path: "root/a.mp3" as WorkspacePath }),
        makeEntry({ name: "b.mp3", path: "root/b.mp3" as WorkspacePath }),
        makeEntry({ name: "c.mp3", path: "root/c.mp3" as WorkspacePath }),
      ],
      selectedPath: null,
    });

    const rows = Array.from(document.querySelectorAll<HTMLButtonElement>(".mle-row"));
    const tabbable = rows.filter((el) => el.tabIndex === 0);
    expect(tabbable.length).toBe(1);
    expect(tabbable[0]?.textContent).toContain("a.mp3");
  });
});
