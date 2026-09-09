import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkspacePath } from "@mimimilli/shared";
import FileColumn from "../../src/features/files/ui/FileColumn";
import type { FsEntry } from "../../src/features/files/model/types";

function file(name: string): FsEntry {
  return {
    name,
    path: `root/${name}` as WorkspacePath,
    isDir: false,
    size: 100,
    fileType: "file",
    childCount: 0,
    workId: null,
    workRelPath: null,
    mediaKind: "other",
    preview: { kind: "available" },
  };
}

function renderColumn(
  props: Partial<React.ComponentProps<typeof FileColumn>> = {},
  entries: FsEntry[] = [file("a.mp3"), file("b.mp3"), file("c.mp3")],
) {
  return render(
    <FileColumn
      title="root"
      entries={entries}
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

describe("FileColumn の矢印キー・roving tabindex（TASK-436）", () => {
  it("ArrowDown/Home/Endが作品一覧と同じ規則で動き、フォーカス移動先でonFocusEntryを呼ぶ", async () => {
    const user = userEvent.setup();
    const onFocusEntry = vi.fn();
    render(
      <FileColumn
        title="root"
        entries={[file("a.mp3"), file("b.mp3"), file("c.mp3")]}
        identityConflictPaths={new Map()}
        selectedPath={null}
        matchPlaying={() => false}
        onOpenDir={vi.fn()}
        onSelectFile={vi.fn()}
        onFocusEntry={onFocusEntry}
        onPlayFile={vi.fn()}
      />,
    );

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
    renderColumn({ selectedPath: "root/b.mp3" as WorkspacePath });

    const rows = Array.from(document.querySelectorAll<HTMLButtonElement>(".mle-row"));
    const tabbable = rows.filter((el) => el.tabIndex === 0);
    expect(tabbable.length).toBe(1);
    expect(tabbable[0]?.textContent).toContain("b.mp3");
  });

  it("roving tabindex: 未選択のときは先頭行がtabIndex 0になる", () => {
    renderColumn({ selectedPath: null });

    const rows = Array.from(document.querySelectorAll<HTMLButtonElement>(".mle-row"));
    const tabbable = rows.filter((el) => el.tabIndex === 0);
    expect(tabbable.length).toBe(1);
    expect(tabbable[0]?.textContent).toContain("a.mp3");
  });
});
