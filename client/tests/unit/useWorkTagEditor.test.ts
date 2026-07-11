import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TagPrefix, Work, WorkPatch } from "@mimimilli/shared";
import { useWorkTagEditor } from "../../src/features/library/ui/preview/useWorkTagEditor";

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: null, showAsAxis: true, protected: true },
  { prefix: "カテゴリ", label: "カテゴリ", color: null, showAsAxis: true, protected: false },
];

function makeWork(tags: string[]): Work {
  return {
    id: "work-1",
    title: "作品1",
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
    defaultPlaylist: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    playlists: [],
    resumePosition: 0,
    resumeTrackIndex: 0,
  };
}

// 実際のUIでは work は PreviewPane から渡される props で、保存成功後は
// 親側がクエリキャッシュを更新して新しい work を渡し直す。フックのテストでも
// その挙動を rerender で模してから tags 等を検証する。
function renderTagEditor(initialWork: Work, onPatchWork: (body: WorkPatch) => Promise<Work>) {
  const onError = vi.fn();
  const rendered = renderHook(
    (props: { work: Work }) =>
      useWorkTagEditor({
        work: props.work,
        tagSuggestions: [],
        tagPrefixes: PREFIXES,
        isPatching: false,
        onPatchWork,
        onError,
      }),
    { initialProps: { work: initialWork } },
  );
  return { ...rendered, onError };
}

describe("useWorkTagEditor", () => {
  it("削除に成功するとundoトーストが出て、undoで元のタグ集合へ戻す", async () => {
    const work = makeWork(["cv/水瀬なずな", "ASMR", "癒し系"]);
    let currentTags = work.tags;
    const onPatchWork = vi.fn(async (body: WorkPatch): Promise<Work> => {
      currentTags = body.tags ?? currentTags;
      return { ...work, tags: currentTags };
    });

    const { result, rerender } = renderTagEditor(work, onPatchWork);

    await act(async () => {
      await result.current.requestRemoveTag("ASMR");
    });
    rerender({ work: { ...work, tags: currentTags } });

    expect(onPatchWork).toHaveBeenCalledWith({ tags: ["cv/水瀬なずな", "癒し系"] });
    expect(result.current.tagUndoToast).toBe("ASMR");
    expect(result.current.tags).toEqual(["cv/水瀬なずな", "癒し系"]);

    await act(async () => {
      await result.current.undoRemoveTag();
    });
    rerender({ work: { ...work, tags: currentTags } });

    expect(onPatchWork).toHaveBeenLastCalledWith({ tags: ["cv/水瀬なずな", "癒し系", "ASMR"] });
    expect(result.current.tagUndoToast).toBeNull();
  });

  it("保護prefixのタグは即削除せず確認待ちになり、confirmで削除される", async () => {
    const work = makeWork(["cv/水瀬なずな", "ASMR"]);
    let currentTags = work.tags;
    const onPatchWork = vi.fn(async (body: WorkPatch): Promise<Work> => {
      currentTags = body.tags ?? currentTags;
      return { ...work, tags: currentTags };
    });

    const { result, rerender } = renderTagEditor(work, onPatchWork);

    await act(async () => {
      await result.current.requestRemoveTag("cv/水瀬なずな");
    });
    // まだ削除されず確認待ち
    expect(onPatchWork).not.toHaveBeenCalled();
    expect(result.current.confirmingRemoveTag).toBe("cv/水瀬なずな");

    await act(async () => {
      await result.current.confirmRemoveTag();
    });
    rerender({ work: { ...work, tags: currentTags } });

    expect(onPatchWork).toHaveBeenCalledWith({ tags: ["ASMR"] });
    expect(result.current.confirmingRemoveTag).toBeNull();
    expect(result.current.tagUndoToast).toBe("cv/水瀬なずな");
  });

  it("保護prefixのタグ削除確認はキャンセルできる", async () => {
    const work = makeWork(["cv/水瀬なずな"]);
    const onPatchWork = vi.fn();

    const { result } = renderTagEditor(
      work,
      onPatchWork as unknown as (body: WorkPatch) => Promise<Work>,
    );

    await act(async () => {
      await result.current.requestRemoveTag("cv/水瀬なずな");
    });
    act(() => {
      result.current.cancelRemoveTag();
    });

    expect(result.current.confirmingRemoveTag).toBeNull();
    expect(onPatchWork).not.toHaveBeenCalled();
  });

  it("非保護prefixの構造化タグは確認なしで削除される", async () => {
    const work = makeWork(["カテゴリ/音声作品", "ASMR"]);
    let currentTags = work.tags;
    const onPatchWork = vi.fn(async (body: WorkPatch): Promise<Work> => {
      currentTags = body.tags ?? currentTags;
      return { ...work, tags: currentTags };
    });

    const { result } = renderTagEditor(work, onPatchWork);

    await act(async () => {
      await result.current.requestRemoveTag("カテゴリ/音声作品");
    });

    expect(result.current.confirmingRemoveTag).toBeNull();
    expect(onPatchWork).toHaveBeenCalledWith({ tags: ["ASMR"] });
  });

  it("構造化タグを追加できる（正規化・重複チェックあり）", async () => {
    const work = makeWork(["ASMR"]);
    let currentTags = work.tags;
    const onPatchWork = vi.fn(async (body: WorkPatch): Promise<Work> => {
      currentTags = body.tags ?? currentTags;
      return { ...work, tags: currentTags };
    });

    const { result, rerender } = renderTagEditor(work, onPatchWork);

    await act(async () => {
      await result.current.addTag("CV/ 新人 ");
    });
    rerender({ work: { ...work, tags: currentTags } });
    expect(onPatchWork).toHaveBeenCalledWith({ tags: ["ASMR", "cv/新人"] });

    // 正規化後に重複する追加は何もしない
    await act(async () => {
      await result.current.addTag("cv/新人");
    });
    expect(onPatchWork).toHaveBeenCalledTimes(1);
  });

  it("削除に失敗するとfailedRemoveTagが立ち、undoトーストは出ない", async () => {
    const work = makeWork(["ASMR", "癒し系"]);
    const onPatchWork = vi.fn(() => Promise.reject(new Error("network error")));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useWorkTagEditor({
        work,
        tagSuggestions: [],
        tagPrefixes: PREFIXES,
        isPatching: false,
        onPatchWork,
        onError,
      }),
    );

    await act(async () => {
      await result.current.requestRemoveTag("ASMR");
    });

    expect(result.current.failedRemoveTag).toBe("ASMR");
    expect(result.current.tagUndoToast).toBeNull();
    expect(onError).toHaveBeenCalledWith("タグを保存できませんでした。");
  });

  it("undo待ちの間に別のタグを追加していても、undoはundo対象のタグだけを戻す", async () => {
    const work = makeWork(["ASMR", "癒し系"]);
    let currentTags = work.tags;
    const onPatchWork = vi.fn(async (body: WorkPatch): Promise<Work> => {
      currentTags = body.tags ?? currentTags;
      return { ...work, tags: currentTags };
    });

    const { result, rerender } = renderTagEditor(work, onPatchWork);

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
    const onPatchWork = vi.fn(
      () =>
        new Promise<Work>((resolve) => {
          resolveRemove = () => resolve({ ...work, tags: [] });
        }),
    );

    const { result } = renderHook(() =>
      useWorkTagEditor({
        work,
        tagSuggestions: [],
        tagPrefixes: PREFIXES,
        isPatching: false,
        onPatchWork,
        onError: vi.fn(),
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
    expect(onPatchWork).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRemove?.();
      await removePromise;
    });
    expect(result.current.tagUndoToast).toBe("ASMR");
  });

  it("アンマウント時にundoタイマーを解放する", async () => {
    vi.useFakeTimers();
    const work = makeWork(["ASMR"]);
    const onPatchWork = vi.fn(async (): Promise<Work> => ({ ...work, tags: [] }));
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { result, unmount } = renderHook(() =>
      useWorkTagEditor({
        work,
        tagSuggestions: [],
        tagPrefixes: PREFIXES,
        isPatching: false,
        onPatchWork,
        onError: vi.fn(),
      }),
    );

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
