import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { FsEntry } from "@mimimilli/shared";
import FileRow from "../../src/features/files/ui/FileRow";

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

function renderRow(entry: FsEntry, overrides: Partial<React.ComponentProps<typeof FileRow>> = {}) {
  return render(
    <FileRow
      entry={entry}
      identityConflict={null}
      isFocused={false}
      isPlaying={false}
      onClick={vi.fn()}
      onActivate={vi.fn()}
      {...overrides}
    />,
  );
}

describe("FileRow", () => {
  it("単一ファイルが自分自身の作品として登録済みなら作品バッジを出す（TASK-428.18 / files-A-02）", () => {
    renderRow(makeEntry({ workId: "RJ501001", workRelPath: "" }));
    expect(screen.getByText("RJ501001")).toBeTruthy();
  });

  it("フォルダー内の1ファイルだけが登録された作品扱いのときはバッジを出さない", () => {
    renderRow(makeEntry({ workId: "RJ501001", workRelPath: "track02.mp3" }));
    expect(screen.queryByText("RJ501001")).toBeNull();
  });

  it("未登録ファイルはバッジを出さない", () => {
    renderRow(makeEntry());
    expect(screen.queryByText("作品")).toBeNull();
  });
});
