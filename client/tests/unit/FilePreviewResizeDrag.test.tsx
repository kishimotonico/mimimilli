// FilePreviewのプレビュー幅リサイズ（role="separator"）はmouse主ボタンのみでdragを開始する。
import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import FilePreview from "../../src/features/files/ui/FilePreview";

const browseFs = vi.fn();
const getScanDiagnostics = vi.fn();

vi.mock("../../src/features/files/api", () => ({
  browseFs: (...args: unknown[]) => browseFs(...args),
  getScanDiagnostics: (...args: unknown[]) => getScanDiagnostics(...args),
}));

vi.mock("../../src/entities/settings/useSettingsQuery", () => ({
  useRootFolder: () => "/lib",
}));

function renderPreview() {
  browseFs.mockResolvedValue({ entries: [], workId: null });
  getScanDiagnostics.mockResolvedValue({ diagnostics: [] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, children),
    );
  return render(createElement(FilePreview, { onPlayFile: vi.fn(), onTogglePlay: vi.fn() }), {
    wrapper,
  });
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
