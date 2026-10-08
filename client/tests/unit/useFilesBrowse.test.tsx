// 矢印キーでの子フォルダー選択（クリックと違いフォルダーへは潜らない）の回帰テスト。
// previewEntryが子フォルダーを指しても、folderEntries/playbackSourceEntriesが
// 親フォルダーの一覧のままにならないことを固定する。
import { createElement } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { workspacePath, type FsEntry } from "@mimimilli/shared";
import { useFilesBrowse } from "../../src/features/files/model/useFilesBrowse";
import { selectFilesEntryAtom } from "../../src/features/files/model/filesNavigationActions";
import { mockApi } from "../helpers/api";
import { buildFsEntry, buildFsListing } from "../helpers/builders";

function entry(overrides: Partial<FsEntry> & { path: string }): FsEntry {
  return buildFsEntry({ size: 0, fileType: "", mediaKind: null, preview: null, ...overrides });
}

const parentAudio = entry({
  name: "parent.mp3",
  path: "parent.mp3",
  mediaKind: "audio",
  fileType: "mp3",
});
const subDir = entry({ name: "sub", path: "sub", isDir: true, childCount: 1 });
const childAudio = entry({
  name: "child.mp3",
  path: "sub/child.mp3",
  mediaKind: "audio",
  fileType: "mp3",
});

function renderBrowse() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, children),
    );
  const result = renderHook(() => useFilesBrowse(""), { wrapper });
  return { ...result, store };
}

describe("useFilesBrowse", () => {
  it("矢印キーで選択した子フォルダーの件数・再生対象は子自身の中身を見る", async () => {
    mockApi({
      "GET /api/fs": ({ url }) =>
        url.searchParams.get("path") === "sub"
          ? buildFsListing([childAudio], { path: workspacePath("sub"), parent: workspacePath("") })
          : buildFsListing([subDir, parentAudio], { path: workspacePath("") }),
    });

    const { result, store } = renderBrowse();

    await waitFor(() => expect(result.current.entries).toHaveLength(2));

    // 矢印キーでの行移動はクリックと違いopenDirを呼ばず選択だけを移す（FileColumnのonFocusEntry）。
    store.set(selectFilesEntryAtom, "sub");

    await waitFor(() => expect(result.current.previewEntry?.path).toBe("sub"));
    await waitFor(() => expect(result.current.folderEntries).not.toBeNull());

    expect(result.current.folderEntries).toEqual([childAudio]);
    expect(result.current.playbackSourceEntries).toEqual([childAudio]);
  });
});
