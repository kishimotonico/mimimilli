// FilePreview: 再生キューの材料（playbackSourceEntries）を縛る回帰テスト。
// ファイル単体選択時に同じフォルダー内の他の音声を次トラックとして繋げること、
// フォルダー選択時は先頭の音声から再生することを確認する（旧 FilesView.handlePlayFile の挙動）。
import { createElement, type ReactNode } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import FilePreview from "../../src/features/files/ui/FilePreview";
import { toSelectedRelPath } from "../../src/entities/file-system/model/navigationAtoms";
import { seedFilesRoute } from "../helpers/route";
import type { FsEntry } from "../../src/features/files/model/types";

const browseFs = vi.fn();
const getScanDiagnostics = vi.fn();

vi.mock("../../src/features/files/api", () => ({
  browseFs: (...args: unknown[]) => browseFs(...args),
  getScanDiagnostics: (...args: unknown[]) => getScanDiagnostics(...args),
}));

vi.mock("../../src/entities/settings/useSettingsQuery", () => ({
  useRootFolder: () => "/lib",
}));

function audioFile(name: string): FsEntry {
  return {
    name,
    path: name,
    isDir: false,
    size: 100,
    fileType: "audio",
    childCount: 0,
    workId: null,
    workRelPath: null,
    mediaKind: "audio",
    preview: { kind: "available" },
  };
}

function renderPreview(selectedPath: string | null, onPlayFile = vi.fn()) {
  getScanDiagnostics.mockResolvedValue({ diagnostics: [] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();
  seedFilesRoute(store, { selectedRelPath: toSelectedRelPath(selectedPath) });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, children),
    );
  render(createElement(FilePreview, { onPlayFile, onTogglePlay: vi.fn() }), { wrapper });
  return { onPlayFile };
}

afterEach(cleanup);

describe("FilePreview 再生キュー", () => {
  it("音声2件のフォルダーで2件目のファイルを選び「このファイルを再生」→ 2トラック・trackIndex=1で再生される", async () => {
    const entries = [audioFile("audio1.wav"), audioFile("audio2.wav")];
    browseFs.mockResolvedValue({ entries, workId: null });
    const { onPlayFile } = renderPreview("audio2.wav");

    await userEvent.click(await screen.findByRole("button", { name: "このファイルを再生" }));

    expect(onPlayFile).toHaveBeenCalledTimes(1);
    const [tracks, trackIndex] = onPlayFile.mock.calls[0];
    expect(tracks).toHaveLength(2);
    expect(trackIndex).toBe(1);
  });

  it("フォルダー選択時の「先頭の音声を再生」→ 1件目から再生される", async () => {
    const entries = [audioFile("audio1.wav"), audioFile("audio2.wav")];
    browseFs.mockResolvedValue({ entries, workId: null });
    const { onPlayFile } = renderPreview(null);

    await userEvent.click(await screen.findByRole("button", { name: "先頭の音声を再生" }));

    expect(onPlayFile).toHaveBeenCalledTimes(1);
    const [tracks, trackIndex] = onPlayFile.mock.calls[0];
    expect(tracks).toHaveLength(2);
    expect(trackIndex).toBe(0);
  });
});
