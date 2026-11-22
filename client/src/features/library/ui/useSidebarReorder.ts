// 編集中のサイドバーの行の並べ替え。ドロップ先の指示から全件の ID 列を作り、編集の口へ渡す。

import { useEffect, useRef } from "react";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/list-item";
import { SMART_FOLDER_DRAG_TYPE } from "./SidebarEditRow";
import { reorderIds } from "../model/smartFolderEditing";

interface SidebarReorderOptions {
  enabled: boolean;
  orderedIds: readonly string[];
  reorder: (ids: string[]) => Promise<void>;
  onDragStart: () => void;
}

export function useSidebarReorder({
  enabled,
  orderedIds,
  reorder,
  onDragStart,
}: SidebarReorderOptions): void {
  const latest = useRef({ orderedIds, reorder, onDragStart });
  latest.current = { orderedIds, reorder, onDragStart };

  useEffect(() => {
    if (!enabled) return;
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === SMART_FOLDER_DRAG_TYPE,
      onDragStart: () => latest.current.onDragStart(),
      onDrop: ({ source, location }) => {
        const target = location.current.dropTargets[0];
        if (!target) return;
        const operation = extractInstruction(target.data)?.operation;
        if (operation !== "reorder-before" && operation !== "reorder-after") return;
        const next = reorderIds(
          latest.current.orderedIds,
          String(source.data.id),
          String(target.data.id),
          operation,
        );
        if (next) void latest.current.reorder(next);
      },
    });
  }, [enabled]);
}
