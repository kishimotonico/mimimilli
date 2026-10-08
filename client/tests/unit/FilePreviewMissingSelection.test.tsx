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
import {
  filesSelectedPathAtom,
  toSelectedRelPath,
} from "../../src/entities/file-system/model/navigationAtoms";
import { seedFilesRoute } from "../helpers/route";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { apiError, mockApi } from "../helpers/api";
import { buildFsListing, buildScanDiagnostics, buildSettings } from "../helpers/builders";
import { workspacePath } from "@mimimilli/shared";

vi.mock("../../src/entities/player/model/usePlayerActions", () => ({
  usePlayerActions: () => ({ playFile: vi.fn(), togglePlay: vi.fn() }),
}));

const MISSING_PATH = workspacePath("dlsite/夜想曲スタジオ/nonexistent");

function renderPreview(selectedPath: string | null, fsReply: unknown = buildFsListing()) {
  const settings = buildSettings({ rootFolder: "dlsite/夜想曲スタジオ" });
  mockApi({
    "GET /api/fs": fsReply,
    "GET /api/scan/diagnostics": buildScanDiagnostics(),
    "GET /api/settings": settings,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), settings);
  const store = createStore();
  seedFilesRoute(store, { selectedRelPath: toSelectedRelPath(selectedPath) });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, children),
    );
  render(createElement(FilePreview), { wrapper });
  return store;
}

afterEach(cleanup);

describe("FilePreview missingSelectionPath", () => {
  it("見つからない旨を表示し、登録・再生の操作を出さない", async () => {
    renderPreview(MISSING_PATH);

    expect(
      await screen.findByText("このファイルまたはフォルダーは見つかりません"),
    ).toBeInTheDocument();
    expect(screen.getByText(MISSING_PATH)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /作品として登録/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /再生/ })).toBeNull();
  });

  it("loadErrorがあるときはmissingSelectionPathより404表示を優先する", async () => {
    renderPreview(MISSING_PATH, apiError(404, "not_found", "not found"));

    expect(await screen.findByText("このフォルダーは見つかりません")).toBeInTheDocument();
    expect(screen.queryByText("このファイルまたはフォルダーは見つかりません")).toBeNull();
  });

  it("「この一覧の表示に戻る」で選択を解除する", async () => {
    const store = renderPreview(MISSING_PATH);

    await userEvent.click(await screen.findByRole("button", { name: "この一覧の表示に戻る" }));
    expect(store.get(filesSelectedPathAtom)).toBeNull();
  });
});
