// FilePreview: missingSelectionPath（TASK-428.18）専用のテスト。
// ディレクトリ取得自体は成功したが選択中パスが一覧に無いケースを、404（loadError）と
// 区別して「対象なし」表示にすることを確認する。
import { createElement } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import FilePreview from "../../src/features/files/ui/FilePreview";

function renderPreview(overrides: Partial<React.ComponentProps<typeof FilePreview>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props: React.ComponentProps<typeof FilePreview> = {
    entry: null,
    folderEntries: null,
    depth: 1,
    browsePath: "dlsite/夜想曲スタジオ",
    isPlayingEntry: false,
    isPlaybackActive: false,
    onPlay: vi.fn(),
    onTogglePlay: vi.fn(),
    identityConflict: null,
    loadError: null,
    onRetryLoad: vi.fn(),
    hasAncestors: true,
    onGoUp: vi.fn(),
    onGoRoot: vi.fn(),
    missingSelectionPath: null,
    onClearSelection: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return render(
    createElement(QueryClientProvider, { client: queryClient }, createElement(FilePreview, props)),
  );
}

afterEach(cleanup);

describe("FilePreview missingSelectionPath", () => {
  it("見つからない旨を表示し、登録・再生の操作を出さない", () => {
    renderPreview({
      missingSelectionPath: "dlsite/夜想曲スタジオ/nonexistent",
    });
    expect(screen.getByText("このファイルまたはフォルダーは見つかりません")).toBeTruthy();
    expect(screen.getByText("dlsite/夜想曲スタジオ/nonexistent")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /作品として登録/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /再生/ })).toBeNull();
  });

  it("loadErrorがあるときはmissingSelectionPathより404表示を優先する", () => {
    renderPreview({
      loadError: "notFound",
      missingSelectionPath: "dlsite/夜想曲スタジオ/nonexistent",
    });
    expect(screen.getByText("このフォルダーは見つかりません")).toBeTruthy();
    expect(screen.queryByText("このファイルまたはフォルダーは見つかりません")).toBeNull();
  });

  it("「この一覧の表示に戻る」でonClearSelectionを呼ぶ", async () => {
    const onClearSelection = vi.fn();
    renderPreview({
      missingSelectionPath: "dlsite/夜想曲スタジオ/nonexistent",
      onClearSelection,
    });
    await userEvent.click(screen.getByRole("button", { name: "この一覧の表示に戻る" }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });
});
