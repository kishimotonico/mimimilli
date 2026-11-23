import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachInstruction,
  extractInstruction,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/list-item";
import { I } from "../../../shared/ui/Icon";
import type { SidebarRow } from "../model/sidebarRows";
import type { ReorderOperation } from "../model/smartFolderEditing";

export const SMART_FOLDER_DRAG_TYPE = "smart-folder";

interface SidebarEditRowProps {
  row: SidebarRow;
  canRemove: boolean;
  /** モバイル幅ではドラッグを出さない（ADR-0042） */
  draggableEnabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

/** 編集の状態の行。グリップでなく行全体がドラッグ元で、上半分・下半分で前後を決める */
export default function SidebarEditRow({
  row,
  canRemove,
  draggableEnabled,
  onEdit,
  onRemove,
}: SidebarEditRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [drop, setDrop] = useState<ReorderOperation | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !draggableEnabled) return;
    const rowId = row.id;
    return combine(
      draggable({
        element,
        getInitialData: () => ({ type: SMART_FOLDER_DRAG_TYPE, id: rowId }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          source.data.type === SMART_FOLDER_DRAG_TYPE && source.data.id !== rowId,
        getData: ({ input, element: target }) =>
          attachInstruction(
            { type: SMART_FOLDER_DRAG_TYPE, id: rowId },
            {
              input,
              element: target,
              operations: { "reorder-before": "available", "reorder-after": "available" },
            },
          ),
        onDrag: ({ self }) => {
          const operation = extractInstruction(self.data)?.operation;
          setDrop(
            operation === "reorder-before" || operation === "reorder-after" ? operation : null,
          );
        },
        onDragLeave: () => setDrop(null),
        onDrop: () => setDrop(null),
      }),
    );
  }, [row.id, draggableEnabled]);

  const Icon = I[row.icon];
  const classes = [
    "mll-sbrow",
    "is-editing",
    dragging ? "is-dragging" : "",
    drop === "reorder-before" ? "is-drop-before" : "",
    drop === "reorder-after" ? "is-drop-after" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={classes} data-folder-id={row.id}>
      {draggableEnabled && <I.grip size={13} className="grip" />}
      <Icon size={15} />
      <span className="nm">{row.name}</span>
      <button
        type="button"
        className="act"
        title="編集"
        aria-label={`「${row.name}」を編集`}
        onClick={onEdit}
      >
        <I.edit size={13} />
      </button>
      {canRemove ? (
        <button
          type="button"
          className="act"
          title="削除"
          aria-label={`「${row.name}」を削除`}
          onClick={onRemove}
        >
          <I.trash size={13} />
        </button>
      ) : (
        <span className="act is-empty" aria-hidden="true" />
      )}
    </div>
  );
}
