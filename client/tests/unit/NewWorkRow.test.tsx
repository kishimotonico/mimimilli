import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { WorkListItem, WorkspacePath } from "@mimimilli/shared";
import NewWorkRow from "../../src/features/scan/ui/scanModal/newWorks/NewWorkRow";
import type { InlineTitleEdit } from "../../src/features/scan/ui/scanModal/newWorks/useInlineTitleEdit";

vi.mock("../../src/entities/work/ui/SourceProjectionNotice", () => ({
  SourceProjectionNotice: () => null,
}));

afterEach(cleanup);

const work: WorkListItem = {
  id: "w1",
  title: "作品",
  cover: null,
  status: "ok",
  totalDurationSec: null,
  trackCount: 3,
  bookmarked: false,
  lastPlayedAt: null,
  circleName: null,
  relativePath: "a/b" as WorkspacePath,
  dlsite: { rjCode: null, status: "none" },
};

function renderEditing() {
  const edit: InlineTitleEdit = {
    editingId: work.id,
    editTitle: "へんかん",
    editSaving: false,
    editErrorFor: () => null,
    titleInputRef: { current: null },
    startEdit: vi.fn(),
    changeTitle: vi.fn(),
    saveTitle: vi.fn(),
    cancelEdit: vi.fn(),
    projection: null,
    projectionPath: null,
    applyProjected: vi.fn(),
  };
  render(<NewWorkRow work={work} edit={edit} onOpenFiles={vi.fn()} onOpenWorkDetail={vi.fn()} />);
  return { edit, input: screen.getByRole("textbox") };
}

describe("NewWorkRow のタイトル編集キー操作", () => {
  it("IME変換中のEnterでは保存しない", () => {
    const { edit, input } = renderEditing();
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(edit.saveTitle).not.toHaveBeenCalled();
  });

  it("isComposingが立たなくてもkeyCode 229のEnterでは保存しない", () => {
    const { edit, input } = renderEditing();
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(edit.saveTitle).not.toHaveBeenCalled();
  });

  it("変換確定後のEnterで保存する", () => {
    const { edit, input } = renderEditing();
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(edit.saveTitle).toHaveBeenCalledExactlyOnceWith(work.id);
  });

  it("Escapeで編集を取り消す", () => {
    const { edit, input } = renderEditing();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(edit.cancelEdit).toHaveBeenCalledOnce();
    expect(edit.saveTitle).not.toHaveBeenCalled();
  });
});

describe("NewWorkRow の表示と操作", () => {
  function renderRow(overrides: Partial<WorkListItem> = {}) {
    const onOpenFiles = vi.fn();
    const onOpenWorkDetail = vi.fn();
    const edit: InlineTitleEdit = {
      editingId: null,
      editTitle: "",
      editSaving: false,
      editErrorFor: () => null,
      titleInputRef: { current: null },
      startEdit: vi.fn(),
      changeTitle: vi.fn(),
      saveTitle: vi.fn(),
      cancelEdit: vi.fn(),
      projection: null,
      projectionPath: null,
      applyProjected: vi.fn(),
    };
    render(
      <NewWorkRow
        work={{ ...work, ...overrides }}
        edit={edit}
        onOpenFiles={onOpenFiles}
        onOpenWorkDetail={onOpenWorkDetail}
      />,
    );
    return { edit, onOpenFiles, onOpenWorkDetail };
  }

  it("パスを押すとFilesで開き、詳細アイコンを押すと作品詳細を開く", () => {
    const { onOpenFiles, onOpenWorkDetail } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: "a/b" }));
    expect(onOpenFiles).toHaveBeenCalledExactlyOnceWith("a/b");
    fireEvent.click(screen.getByRole("button", { name: /作品詳細を開く/ }));
    expect(onOpenWorkDetail).toHaveBeenCalledExactlyOnceWith("w1");
  });

  it("タイトルを押すとその場編集を始める", () => {
    const { edit } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: "作品" }));
    expect(edit.startEdit).toHaveBeenCalledOnce();
  });

  it.each([
    [{ rjCode: "RJ1", status: "applied" as const }, "連携済み"],
    [{ rjCode: "RJ1", status: "none" as const }, "未連携"],
    [{ rjCode: "RJ1", status: "not_found" as const }, "未連携"],
    [{ rjCode: "RJ1", status: "error" as const }, "未連携"],
  ])("DLsite列は %j のとき「%s」で、取得待ちは出ない", (dlsite, label) => {
    renderRow({ dlsite });
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText("取得待ち")).toBeNull();
  });

  it("RJコードが無い作品のDLsite列は空欄", () => {
    renderRow();
    expect(screen.queryByText("連携済み")).toBeNull();
    expect(screen.queryByText("未連携")).toBeNull();
  });
});
