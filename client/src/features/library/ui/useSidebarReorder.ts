// 編集中のサイドバーの行の並べ替え。ドロップ先の指示から全件の ID 列を作り、編集の口へ渡す。
// 保存中は true を返し、呼び出し側は次のドラッグを出さない。

import { useEffect, useRef, useState } from "react";
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
}: SidebarReorderOptions): { saving: boolean } {
  const [saving, setSaving] = useState(false);
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
        if (!next) return;
        setSaving(true);
        void latest.current.reorder(next).finally(() => setSaving(false));
      },
    });
  }, [enabled]);

  return { saving };
}
