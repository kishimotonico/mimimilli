import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TagPrefix, Work } from "@mimimilli/shared";
import type { LibraryTagsPatchMutation } from "../../src/features/library/model/workPatchMutations";
import { useWorkTagEditor } from "../../src/features/library/ui/preview/useWorkTagEditor";

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: null, showAsAxis: true, protected: true },
  { prefix: "カテゴリ", label: "カテゴリ", color: null, showAsAxis: true, protected: false },
];

function makeWork(tags: string[]): Work {
  return {
    id: "work-1",
    title: "作品1",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/works/work-1",
    totalDurationSec: 120,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags,
    bookmarked: false,
    lastPlayedAt: null,
    defaultPlaylistId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    playlists: [],
    resume: null,
  };
}

function createTagsMutation(
  onPatchTags: (tags: string[]) => Promise<Work>,
): LibraryTagsPatchMutation {
  const state = { isPending: false, error: null as Error | null };
  return {
    get isPending() {
      return state.isPending;
    },
    get error() {
      return state.error;
    },
    reset: vi.fn(() => {
      state.error = null;
    }),
    mutateAsync: vi.fn(async ({ tags }: { workId: string; tags: string[] }) => {
      state.isPending = true;
      state.error = null;
      try {
        return await onPatchTags(tags);
      } catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        throw error;
      } finally {
        state.isPending = false;
      }
    }),
  } as unknown as LibraryTagsPatchMutation;
}

// 実際のUIでは work は PreviewPane から渡される props で、保存成功後は
// 親側がクエリキャッシュを更新して新しい work を渡し直す。フックのテストでも
// その挙動を rerender で模してから tags 等を検証する。
function renderTagEditor(initialWork: Work, onPatchTags: (tags: string[]) => Promise<Work>) {
  const tagsMutation = createTagsMutation(onPatchTags);
  const rendered = renderHook(
    (props: { work: Work }) =>
      useWorkTagEditor({
        work: props.work,
        tagSuggestions: [],
        tagPrefixes: PREFIXES,
        tagsMutation,
      }),
    { initialProps: { work: initialWork } },
  );
  return { ...rendered, tagsMutation };
}

describe("useWorkTagEditor", () => {
  it("削除に成功するとundoトーストが出て、undoで元のタグ集合へ戻す", async () => {
    const work = makeWork(["cv/水瀬なずな", "ASMR", "癒し系"]);
    let currentTags = work.tags;
    const onPatchTags = vi.fn(async (tags: string[]): Promise<Work> => {
      currentTags = tags;
      return { ...work, tags: currentTags };
    });

    const { result, rerender } = renderTagEditor(work, onPatchTags);

    await act(async () => {
      await result.current.requestRemoveTag("ASMR");
    });
    rerender({ work: { ...work, tags: currentTags } });

    expect(onPatchTags).toHaveBeenCalledWith(["cv/水瀬なずな", "癒し系"]);
    expect(result.current.tagUndoToast).toBe("ASMR");
    expect(result.current.tags).toEqual(["cv/水瀬なずな", "癒し系"]);

    await act(async () => {
      await result.current.undoRemoveTag();
    });
    rerender({ work: { ...work, tags: currentTags } });

    expect(onPatchTags).toHaveBeenLastCalledWith(["cv/水瀬なずな", "癒し系", "ASMR"]);
    expect(result.current.tagUndoToast).toBeNull();
  });

  it("保護prefixのタグは即削除せず確認待ちになり、confirmで削除される", async () => {
    const work = makeWork(["cv/水瀬なずな", "ASMR"]);
    let currentTags = work.tags;
    const onPatchTags = vi.fn(async (tags: string[]): Promise<Work> => {
      currentTags = tags;
      return { ...work, tags: currentTags };
    });

    const { result, rerender } = renderTagEditor(work, onPatchTags);

    await act(async () => {
      await result.current.requestRemoveTag("cv/水瀬なずな");
    });
    // まだ削除されず確認待ち
    expect(onPatchTags).not.toHaveBeenCalled();
    expect(result.current.confirmingRemoveTag).toBe("cv/水瀬なずな");

    await act(async () => {
      await result.current.confirmRemoveTag();
    });
    rerender({ work: { ...work, tags: currentTags } });

    expect(onPatchTags).toHaveBeenCalledWith(["ASMR"]);
    expect(result.current.confirmingRemoveTag).toBeNull();
    expect(result.current.tagUndoToast).toBe("cv/水瀬なずな");
  });

  it("保護prefixのタグ削除確認はキャンセルできる", async () => {
    const work = makeWork(["cv/水瀬なずな"]);
    const onPatchTags = vi.fn();

    const { result } = renderTagEditor(work, onPatchTags);

    await act(async () => {
      await result.current.requestRemoveTag("cv/水瀬なずな");
    });
    act(() => {
      result.current.cancelRemoveTag();
    });

    expect(result.current.confirmingRemoveTag).toBeNull();
    expect(onPatchTags).not.toHaveBeenCalled();
  });

  it("非保護prefixの構造化タグは確認なしで削除される", async () => {
    const work = makeWork(["カテゴリ/音声作品", "ASMR"]);
    let currentTags = work.tags;
    const onPatchTags = vi.fn(async (tags: string[]): Promise<Work> => {
      currentTags = tags;
      return { ...work, tags: currentTags };
    });

    const { result } = renderTagEditor(work, onPatchTags);

    await act(async () => {
      await result.current.requestRemoveTag("カテゴリ/音声作品");
    });

    expect(result.current.confirmingRemoveTag).toBeNull();
    expect(onPatchTags).toHaveBeenCalledWith(["ASMR"]);
  });

  it("構造化タグを追加できる（正規化・重複チェックあり）", async () => {
    const work = makeWork(["ASMR"]);
    let currentTags = work.tags;
    const onPatchTags = vi.fn(async (tags: string[]): Promise<Work> => {
      currentTags = tags;
      return { ...work, tags: currentTags };
    });

    const { result, rerender } = renderTagEditor(work, onPatchTags);

    await act(async () => {
      await result.current.addTag("CV/ 新人 ");
    });
    rerender({ work: { ...work, tags: currentTags } });
    expect(onPatchTags).toHaveBeenCalledWith(["ASMR", "cv/新人"]);

    // 正規化後に重複する追加は何もしない
    await act(async () => {
      await result.current.addTag("cv/新人");
    });
    expect(onPatchTags).toHaveBeenCalledTimes(1);
  });

  it("削除に失敗するとfailedRemoveTagが立ち、undoトーストは出ない", async () => {
    const work = makeWork(["ASMR", "癒し系"]);
    const onPatchTags = vi.fn(() => Promise.reject(new Error("network error")));

    const { result } = renderTagEditor(work, onPatchTags);

    await act(async () => {
      await result.current.requestRemoveTag("ASMR");
    });

    expect(result.current.failedRemoveTag).toBe("ASMR");
    expect(result.current.tagUndoToast).toBeNull();
    expect(result.current.patchTagsError).toBeInstanceOf(Error);
    expect((result.current.patchTagsError as Error).message).toBe("network error");
  });

  it("undo待ちの間に別のタグを追加していても、undoはundo対象のタグだけを戻す", async () => {
    const work = makeWork(["ASMR", "癒し系"]);
    let currentTags = work.tags;
    const onPatchTags = vi.fn(async (tags: string[]): Promise<Work> => {
      currentTags = tags;
      return { ...work, tags: currentTags };
    });

    const { result, rerender } = renderTagEditor(work, onPatchTags);

    await act(async () => {
      await result.current.requestRemoveTag("ASMR");
    });
    expect(result.current.tagUndoToast).toBe("ASMR");

    // undo待ちの間に別のタグを追加（別編集はundoで巻き戻さない）
    rerender({ work: { ...work, tags: currentTags } });
    await act(async () => {
      await result.current.addTag("新規タグ");
    });
    rerender({ work: { ...work, tags: currentTags } });
    expect(result.current.tags).toEqual(["癒し系", "新規タグ"]);
    await act(async () => {
      await result.current.undoRemoveTag();
    });
    rerender({ work: { ...work, tags: currentTags } });

    expect(result.current.tags).toEqual(["癒し系", "新規タグ", "ASMR"]);
  });

  it("保存中はundo要求を無視し、トーストを残す", async () => {
    const work = makeWork(["ASMR"]);
    let resolveRemove: (() => void) | null = null;
    const state = { isPending: false, error: null as Error | null };
    const tagsMutation = {
      get isPending() {
        return state.isPending;
      },
      get error() {
        return state.error;
      },
      reset: vi.fn(),
      mutateAsync: vi.fn(
        () =>
          new Promise<Work>((resolve) => {
            state.isPending = true;
            resolveRemove = () => {
              state.isPending = false;
              resolve({ ...work, tags: [] });
            };
          }),
      ),
    } as unknown as LibraryTagsPatchMutation;

    const { result } = renderHook(() =>
      useWorkTagEditor({
        work,
        tagSuggestions: [],
        tagPrefixes: PREFIXES,
        tagsMutation,
      }),
    );

    let removePromise: Promise<void>;
    act(() => {
      removePromise = result.current.requestRemoveTag("ASMR");
    });
    expect(result.current.isTagSaving).toBe(true);

    // 保存中にundoを呼んでも何も起きない（トーストはまだ出ていない）
    await act(async () => {
      await result.current.undoRemoveTag();
    });
    expect(tagsMutation.mutateAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRemove?.();
      await removePromise;
    });
    expect(result.current.tagUndoToast).toBe("ASMR");
  });

  it("アンマウント時にundoタイマーを解放する", async () => {
    vi.useFakeTimers();
    const work = makeWork(["ASMR"]);
    const onPatchTags = vi.fn(async (): Promise<Work> => ({ ...work, tags: [] }));
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { result, unmount } = renderTagEditor(work, onPatchTags);

    await act(async () => {
      await result.current.requestRemoveTag("ASMR");
    });
    expect(result.current.tagUndoToast).toBe("ASMR");

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });
});
