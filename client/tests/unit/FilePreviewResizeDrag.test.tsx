// FilePreviewのプレビュー幅リサイズ（role="separator"）はmouse主ボタンのみでdragを開始する。
import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import FilePreview from "../../src/features/files/ui/FilePreview";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { mockApi } from "../helpers/api";
import { buildFsListing, buildScanDiagnostics, buildSettings } from "../helpers/builders";

vi.mock("../../src/entities/player/model/usePlayerActions", () => ({
  usePlayerActions: () => ({ playFile: vi.fn(), togglePlay: vi.fn() }),
}));

function renderPreview() {
  const settings = buildSettings({ rootFolder: "/lib" });
  mockApi({
    "GET /api/fs": buildFsListing(),
    "GET /api/scan/diagnostics": buildScanDiagnostics(),
    "GET /api/settings": settings,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), settings);
  const store = createStore();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, children),
    );
  return render(createElement(FilePreview), { wrapper });
}

afterEach(cleanup);

describe("FilePreview リサイズハンドルの主ボタン判定", () => {
  it("主ボタンのpointerdownでポインターキャプチャを取得しdragを開始する", () => {
    renderPreview();
    const separator = screen.getByRole("separator", { name: "プレビュー幅" });
    const setPointerCapture = vi.spyOn(separator, "setPointerCapture");

    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 100, button: 0 });
    expect(setPointerCapture).toHaveBeenCalledWith(1);
  });

  it("中央・右クリックのpointerdownではdragを開始しない", () => {
    renderPreview();
    const separator = screen.getByRole("separator", { name: "プレビュー幅" });
    const setPointerCapture = vi.spyOn(separator, "setPointerCapture");

    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 100, button: 1 });
    fireEvent.pointerDown(separator, { pointerId: 2, clientX: 100, button: 2 });
    expect(setPointerCapture).not.toHaveBeenCalled();
  });
});
