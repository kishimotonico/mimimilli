// FilePreview: 再生キューの材料（playbackSourceEntries）を縛る回帰テスト。
// ファイル単体選択時に同じフォルダー内の他の音声を次トラックとして繋げること、
// フォルダー選択時は先頭の音声から再生することを確認する（旧 FilesView.handlePlayFile の挙動）。
import { createElement, type ReactNode } from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
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
import type { ScanDiagnostic } from "@mimimilli/shared";
import type { FsEntry } from "../../src/features/files/model/types";

const browseFs = vi.fn();
const getScanDiagnostics = vi.fn();

vi.mock("../../src/features/files/api", () => ({
  browseFs: (...args: unknown[]) => browseFs(...args),
  getScanDiagnostics: (...args: unknown[]) => getScanDiagnostics(...args),
}));

const reassignIdentityConflict = vi.fn();

vi.mock("../../src/entities/work/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/entities/work/api")>()),
  reassignIdentityConflict: (...args: unknown[]) => reassignIdentityConflict(...args),
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

function renderPreview(
  selectedPath: string | null,
  onPlayFile = vi.fn(),
  diagnostics: ScanDiagnostic[] = [],
) {
  getScanDiagnostics.mockResolvedValue({ diagnostics });
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
  return { onPlayFile, store };
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

describe("FilePreview ID重複（単一ファイル形式）", () => {
  const metaPath = "b/single.mimimilli.json";
  const metaEntry: FsEntry = {
    name: "single.mimimilli.json",
    path: metaPath,
    isDir: false,
    size: 100,
    fileType: "json",
    childCount: 0,
    workId: null,
    workRelPath: null,
    mediaKind: "other",
    preview: { kind: "unavailable", reason: "unsupported" },
  };

  it("重複対象のメタファイルを選ぶと、ID重複の説明と再採番ボタンが出る", async () => {
    browseFs.mockResolvedValue({ entries: [metaEntry], workId: null });
    renderPreview(metaPath, vi.fn(), [
      { kind: "identity_conflict", workId: "w1", paths: ["a/single.mimimilli.json", metaPath] },
    ]);

    expect(
      await screen.findByText("同じWork IDを持つメタファイルがあります。"),
    ).toBeInTheDocument();
    expect(screen.getByText("a/single.mimimilli.json")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "別作品として取り込む" })).toBeInTheDocument();
  });

  it("メタファイル行の再採番に成功すると選択が外れ、親フォルダーのプレビューへ戻る", async () => {
    browseFs.mockResolvedValue({ entries: [metaEntry], workId: null });
    reassignIdentityConflict.mockResolvedValue({
      snapshot: { id: "new" },
      projection: { status: "published" },
    });
    const { store } = renderPreview(metaPath, vi.fn(), [
      { kind: "identity_conflict", workId: "w1", paths: ["a/single.mimimilli.json", metaPath] },
    ]);

    await userEvent.click(await screen.findByRole("button", { name: "別作品として取り込む" }));
    await userEvent.click(await screen.findByRole("button", { name: "取り込む" }));

    await waitFor(() => expect(store.get(filesSelectedPathAtom)).toBeNull());
    expect(reassignIdentityConflict).toHaveBeenCalledWith(metaPath);
  });

  it("重複対象でないファイルにはID重複セクションを出さない", async () => {
    browseFs.mockResolvedValue({ entries: [metaEntry], workId: null });
    renderPreview(metaPath);

    await screen.findByText("single.mimimilli.json");
    expect(screen.queryByText("ID重複")).not.toBeInTheDocument();
  });
});
