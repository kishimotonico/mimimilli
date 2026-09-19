// FilePreview: missingSelectionPath 専用のテスト。
// ディレクトリ取得自体は成功したが選択中パスが一覧に無いケースを、404（loadError）と
// 区別して「対象なし」表示にすることを確認する。
import { createElement, type ReactNode } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import FilePreview from "../../src/features/files/ui/FilePreview";
import { filesSelectedPathAtom } from "../../src/entities/file-system/model/navigationAtoms";
import { ApiRequestError } from "../../src/shared/api/http";
import { workspacePath } from "@mimimilli/shared";

const browseFs = vi.fn();
const getScanDiagnostics = vi.fn();

vi.mock("../../src/features/files/api", () => ({
  browseFs: (...args: unknown[]) => browseFs(...args),
  getScanDiagnostics: (...args: unknown[]) => getScanDiagnostics(...args),
}));

vi.mock("../../src/entities/settings/useSettingsQuery", () => ({
  useRootFolder: () => "dlsite/夜想曲スタジオ",
}));

const MISSING_PATH = workspacePath("dlsite/夜想曲スタジオ/nonexistent");

function renderPreview(selectedPath: string | null) {
  getScanDiagnostics.mockResolvedValue({ diagnostics: [] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();
  store.set(filesSelectedPathAtom, selectedPath as never);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, children),
    );
  render(createElement(FilePreview, { onPlayFile: vi.fn(), onTogglePlay: vi.fn() }), { wrapper });
  return store;
}

afterEach(cleanup);

describe("FilePreview missingSelectionPath", () => {
  it("見つからない旨を表示し、登録・再生の操作を出さない", async () => {
    browseFs.mockResolvedValue({ entries: [], workId: null });
    renderPreview(MISSING_PATH);

    expect(await screen.findByText("このファイルまたはフォルダーは見つかりません")).toBeTruthy();
    expect(screen.getByText(MISSING_PATH)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /作品として登録/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /再生/ })).toBeNull();
  });

  it("loadErrorがあるときはmissingSelectionPathより404表示を優先する", async () => {
    browseFs.mockRejectedValue(new ApiRequestError(404, "not_found", "not found"));
    renderPreview(MISSING_PATH);

    expect(await screen.findByText("このフォルダーは見つかりません")).toBeTruthy();
    expect(screen.queryByText("このファイルまたはフォルダーは見つかりません")).toBeNull();
  });

  it("「この一覧の表示に戻る」で選択を解除する", async () => {
    browseFs.mockResolvedValue({ entries: [], workId: null });
    const store = renderPreview(MISSING_PATH);

    await userEvent.click(await screen.findByRole("button", { name: "この一覧の表示に戻る" }));
    expect(store.get(filesSelectedPathAtom)).toBeNull();
  });
});
