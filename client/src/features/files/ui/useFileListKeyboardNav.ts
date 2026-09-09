import { useCallback, type RefObject } from "react";
import type { WorkspacePath } from "@mimimilli/shared";
import { getNextGridIndex, type GridArrowKey } from "../../../shared/lib/gridNavigation";
import type { FsEntry } from "../model/types";

interface UseFileListKeyboardNavOptions {
  listRef: RefObject<HTMLDivElement | null>;
  entries: FsEntry[];
  onFocusEntry: (path: WorkspacePath) => void;
}

// ファイル一覧は仮想化していない（フォルダー1階層ぶんのエントリ数は仮想化を要する規模に
// 通常ならない）ため、移動先の行は常にDOMに存在する。focusVirtualItemのscrollToIndex待ち
// （仮想化用のダブルrAF）は不要で、対象行を直接focusできる（TASK-436）。
export function useFileListKeyboardNav({
  listRef,
  entries,
  onFocusEntry,
}: UseFileListKeyboardNavOptions) {
  return useCallback(
    (currentIndex: number, key: GridArrowKey) => {
      const listEl = listRef.current;
      if (!listEl) return;

      const nextIndex = getNextGridIndex(currentIndex, key, 1, entries.length);
      if (nextIndex === currentIndex) return;

      const nextEntry = entries[nextIndex];
      if (!nextEntry) return;
      onFocusEntry(nextEntry.path);

      const nextEl = listEl.querySelector<HTMLElement>(`[data-flat-index="${nextIndex}"]`);
      nextEl?.focus({ preventScroll: true });
      nextEl?.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
    [listRef, entries, onFocusEntry],
  );
}
