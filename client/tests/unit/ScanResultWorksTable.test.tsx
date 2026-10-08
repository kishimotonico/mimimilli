import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { WorkListItem, WorkspacePath } from "@mimimilli/shared";
import ScanResultWorksTable from "../../src/features/scan/ui/scanModal/ScanResultWorksTable";
import type { InlineTitleEdit } from "../../src/features/scan/ui/scanModal/useInlineTitleEdit";

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
  render(
    <ScanResultWorksTable
      works={[work]}
      caption="新規登録"
      emptyMessage="なし"
      errorMessage={null}
      truncatedTotal={null}
      totalIds={1}
      edit={edit}
    />,
  );
  return { edit, input: screen.getByRole("textbox") };
}

describe("ScanResultWorksTable のタイトル編集キー操作", () => {
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
