// FilePreviewのプレビュー幅リサイズ（role="separator"）はmouse主ボタンのみでdragを開始する。
import { createElement } from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
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
