import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TagPrefix } from "@mimimilli/shared";
import type { LibraryTagIntentMutation } from "../../src/features/library/model/useLibraryQueries";
import { useWorkTagEditor } from "../../src/features/library/ui/preview/useWorkTagEditor";

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: null, showAsAxis: true, protected: true },
  { prefix: "カテゴリ", label: "カテゴリ", color: null, showAsAxis: true, protected: false },
];

function createIntentMutation(onIntent: (tag: string) => Promise<void>): LibraryTagIntentMutation {
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
    mutateAsync: vi.fn(async ({ tag }: { workId: string; tag: string }) => {
      state.isPending = true;
      state.error = null;
      try {
        await onIntent(tag);
        return { snapshot: {} };
      } catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        throw error;
      } finally {
        state.isPending = false;
      }
    }),
  } as unknown as LibraryTagIntentMutation;
}

function renderTagEditor(
  tags: string[],
  onAdd: (tag: string) => Promise<void>,
  onRemove: (tag: string) => Promise<void>,
) {
  const addTagMutation = createIntentMutation(onAdd);
  const removeTagMutation = createIntentMutation(onRemove);
  const rendered = renderHook(
    (props: { tags: string[] }) =>
      useWorkTagEditor({
        workId: "work-1",
        tags: props.tags,
        tagSuggestions: [],
        tagPrefixes: PREFIXES,
        addTagMutation,
        removeTagMutation,
      }),
    { initialProps: { tags } },
  );
  return { ...rendered, addTagMutation, removeTagMutation };
}

describe("useWorkTagEditor", () => {
  it("削除に成功するとundoトーストが出て、undoで元のタグ集合へ戻す", async () => {
    let currentTags = ["cv/水瀬なずな", "ASMR", "癒し系"];
    const onAdd = vi.fn(async (tag: string) => {
      currentTags = [...currentTags, tag];
    });
    const onRemove = vi.fn(async (tag: string) => {
      currentTags = currentTags.filter((item) => item !== tag);
    });

    const { result, rerender } = renderTagEditor(currentTags, onAdd, onRemove);

    await act(async () => {
      await result.current.requestRemoveTag("ASMR");
    });
    rerender({ tags: currentTags });

    expect(onRemove).toHaveBeenCalledWith("ASMR");
    expect(result.current.tagUndoToast).toBe("ASMR");
    expect(result.current.tags).toEqual(["cv/水瀬なずな", "癒し系"]);

    await act(async () => {
      await result.current.undoRemoveTag();
    });
    rerender({ tags: currentTags });

    expect(onAdd).toHaveBeenLastCalledWith("ASMR");
    expect(result.current.tagUndoToast).toBeNull();
  });

  it("保護prefixのタグは即削除せず確認待ちになり、confirmで削除される", async () => {
    let currentTags = ["cv/水瀬なずな", "ASMR"];
    const onAdd = vi.fn(async () => {});
    const onRemove = vi.fn(async (tag: string) => {
      currentTags = currentTags.filter((item) => item !== tag);
    });

    const { result, rerender } = renderTagEditor(currentTags, onAdd, onRemove);

    await act(async () => {
      await result.current.requestRemoveTag("cv/水瀬なずな");
    });
    expect(onRemove).not.toHaveBeenCalled();
    expect(result.current.confirmingRemoveTag).toBe("cv/水瀬なずな");

    await act(async () => {
      await result.current.confirmRemoveTag();
    });
    rerender({ tags: currentTags });

    expect(onRemove).toHaveBeenCalledWith("cv/水瀬なずな");
    expect(result.current.confirmingRemoveTag).toBeNull();
    expect(result.current.tagUndoToast).toBe("cv/水瀬なずな");
  });

  it("保護prefixのタグ削除確認はキャンセルできる", async () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    const { result } = renderTagEditor(["cv/水瀬なずな"], onAdd, onRemove);

    await act(async () => {
      await result.current.requestRemoveTag("cv/水瀬なずな");
    });
    act(() => {
      result.current.cancelRemoveTag();
    });

    expect(result.current.confirmingRemoveTag).toBeNull();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("非保護prefixの構造化タグは確認なしで削除される", async () => {
    let currentTags = ["カテゴリ/音声作品", "ASMR"];
    const onRemove = vi.fn(async (tag: string) => {
      currentTags = currentTags.filter((item) => item !== tag);
    });
    const { result } = renderTagEditor(
      currentTags,
      vi.fn(async () => {}),
      onRemove,
    );

    await act(async () => {
      await result.current.requestRemoveTag("カテゴリ/音声作品");
    });

    expect(result.current.confirmingRemoveTag).toBeNull();
    expect(onRemove).toHaveBeenCalledWith("カテゴリ/音声作品");
  });

  it("構造化タグを追加できる（正規化・重複チェックあり）", async () => {
    let currentTags = ["ASMR"];
    const onAdd = vi.fn(async (tag: string) => {
      currentTags = [...currentTags, tag];
    });
    const { result, rerender } = renderTagEditor(
      currentTags,
      onAdd,
      vi.fn(async () => {}),
    );

    await act(async () => {
      await result.current.addTag("CV/ 新人 ");
    });
    rerender({ tags: currentTags });
    expect(onAdd).toHaveBeenCalledWith("cv/新人");

    await act(async () => {
      await result.current.addTag("cv/新人");
    });
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("削除に失敗するとfailedRemoveTagが立ち、undoトーストは出ない", async () => {
    const onRemove = vi.fn(() => Promise.reject(new Error("network error")));
    const { result } = renderTagEditor(
      ["ASMR", "癒し系"],
      vi.fn(async () => {}),
      onRemove,
    );

    await act(async () => {
      await result.current.requestRemoveTag("ASMR");
    });

    expect(result.current.failedRemoveTag).toBe("ASMR");
    expect(result.current.tagUndoToast).toBeNull();
    expect(result.current.patchTagsError).toBeInstanceOf(Error);
    expect((result.current.patchTagsError as Error).message).toBe("network error");
  });

  it("undo待ちの間に別のタグを追加していても、undoはundo対象のタグだけを戻す", async () => {
    let currentTags = ["ASMR", "癒し系"];
    const onAdd = vi.fn(async (tag: string) => {
      currentTags = [...currentTags, tag];
    });
    const onRemove = vi.fn(async (tag: string) => {
      currentTags = currentTags.filter((item) => item !== tag);
    });
    const { result, rerender } = renderTagEditor(currentTags, onAdd, onRemove);

    await act(async () => {
      await result.current.requestRemoveTag("ASMR");
    });
    expect(result.current.tagUndoToast).toBe("ASMR");

    rerender({ tags: currentTags });
    await act(async () => {
      await result.current.addTag("新規タグ");
    });
    rerender({ tags: currentTags });
    expect(result.current.tags).toEqual(["癒し系", "新規タグ"]);
    await act(async () => {
      await result.current.undoRemoveTag();
    });
    rerender({ tags: currentTags });

    expect(result.current.tags).toEqual(["癒し系", "新規タグ", "ASMR"]);
  });

  it("保存中はundo要求を無視し、トーストを残す", async () => {
    const workTags = ["ASMR"];
    let resolveRemove: (() => void) | null = null;
    const state = { isPending: false, error: null as Error | null };
    const removeTagMutation = {
      get isPending() {
        return state.isPending;
      },
      get error() {
        return state.error;
      },
      reset: vi.fn(),
      mutateAsync: vi.fn(
        () =>
          new Promise((resolve) => {
            state.isPending = true;
            resolveRemove = () => {
              state.isPending = false;
              resolve({ snapshot: {} });
            };
          }),
      ),
    } as unknown as LibraryTagIntentMutation;
    const addTagMutation = createIntentMutation(async () => {});

    const { result } = renderHook(() =>
      useWorkTagEditor({
        workId: "work-1",
        tags: workTags,
        tagSuggestions: [],
        tagPrefixes: PREFIXES,
        addTagMutation,
        removeTagMutation,
      }),
    );

    let removePromise: Promise<void>;
    act(() => {
      removePromise = result.current.requestRemoveTag("ASMR");
    });
    expect(result.current.isTagSaving).toBe(true);

    await act(async () => {
      await result.current.undoRemoveTag();
    });
    expect(removeTagMutation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(addTagMutation.mutateAsync).not.toHaveBeenCalled();

    await act(async () => {
      resolveRemove?.();
      await removePromise;
    });
    expect(result.current.tagUndoToast).toBe("ASMR");
  });
});
