import type { RefObject } from "react";
import type { TagPrefix, TagPrefixColorKey } from "@mimimilli/shared";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import TextInput from "../../../shared/ui/TextInput";
import { ColorSwatches } from "./ColorSwatches";

const TOGGLE_LABEL_CLASS =
  "inline-flex items-center gap-1 font-sans text-secondary text-ink-2 cursor-pointer whitespace-nowrap";

/** 行の上移動・下移動・削除ボタン共通。通常時は控えめな色、hover/focus時だけ濃くする */
const ROW_ICON_CLASS = "text-ink-3 hover:text-ink-1 focus-visible:text-ink-1";

/** 保護中の prefix を削除できない理由。削除ボタンの title に出す */
const PROTECTED_DELETE_TITLE =
  "保護中のprefixは削除できません。削除するには「保護」のチェックを外してください";

interface TagPrefixRowProps {
  prefix: TagPrefix;
  isEditing: boolean;
  editingLabel: string;
  editingLabelInputRef: RefObject<HTMLInputElement | null>;
  isMutating: boolean;
  moveUpDisabled: boolean;
  moveDownDisabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onStartEditLabel: () => void;
  onEditingLabelChange: (label: string) => void;
  onCommitEditLabel: () => void;
  onCancelEditLabel: () => void;
  onColorChange: (color: TagPrefixColorKey | null) => void;
  onShowAsAxisChange: (showAsAxis: boolean) => void;
  onProtectedChange: (isProtected: boolean) => void;
  onRequestDelete: () => void;
}

export default function TagPrefixRow({
  prefix: p,
  isEditing,
  editingLabel,
  editingLabelInputRef,
  isMutating,
  moveUpDisabled,
  moveDownDisabled,
  onMoveUp,
  onMoveDown,
  onStartEditLabel,
  onEditingLabelChange,
  onCommitEditLabel,
  onCancelEditLabel,
  onColorChange,
  onShowAsAxisChange,
  onProtectedChange,
  onRequestDelete,
}: TagPrefixRowProps) {
  const deleteDisabled = isMutating || p.protected;
  return (
    <div className="flex items-center gap-2 border-b border-line-soft px-2.5 py-1.5 last:border-b-0">
      <div className="flex shrink-0 flex-col">
        <IconButton
          icon={I.chevD}
          label={`「${p.label}」を上へ移動`}
          size="xs"
          className={`h-[13px] rotate-180${moveUpDisabled ? "" : ` ${ROW_ICON_CLASS}`}`}
          disabled={moveUpDisabled}
          onClick={onMoveUp}
        />
        <IconButton
          icon={I.chevD}
          label={`「${p.label}」を下へ移動`}
          size="xs"
          className={`h-[13px]${moveDownDisabled ? "" : ` ${ROW_ICON_CLASS}`}`}
          disabled={moveDownDisabled}
          onClick={onMoveDown}
        />
      </div>

      {isEditing ? (
        <TextInput
          ref={editingLabelInputRef}
          value={editingLabel}
          onChange={(e) => onEditingLabelChange(e.target.value)}
          onBlur={onCommitEditLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitEditLabel();
            if (e.key === "Escape") onCancelEditLabel();
          }}
          aria-label={`「${p.prefix}」のラベル`}
          font="jp"
          className="h-[24px] flex-1 rounded-1 px-1.5 text-ink-1"
        />
      ) : (
        <button
          type="button"
          onClick={onStartEditLabel}
          title="クリックしてラベルを編集"
          className="min-w-0 flex-1 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-1 px-1 py-0.5 text-left text-body text-ink-1 hover:bg-paper-2"
        >
          {p.label}
          <span className="ml-1.5 font-mono text-caption text-ink-2">{p.prefix}/</span>
        </button>
      )}

      <ColorSwatches value={p.color} disabled={isMutating} onChange={onColorChange} />

      <label className={TOGGLE_LABEL_CLASS} title="軸レールにこのprefixの軸を表示する">
        <input
          type="checkbox"
          checked={p.showAsAxis}
          disabled={isMutating}
          onChange={(e) => onShowAsAxisChange(e.target.checked)}
        />
        軸
      </label>
      <label className={TOGGLE_LABEL_CLASS} title="このprefixのタグを削除・編集するとき確認を挟む">
        <input
          type="checkbox"
          checked={p.protected}
          disabled={isMutating}
          onChange={(e) => onProtectedChange(e.target.checked)}
        />
        保護
      </label>
      <IconButton
        icon={I.x}
        label={`prefix「${p.prefix}」を削除`}
        title={p.protected ? PROTECTED_DELETE_TITLE : undefined}
        size="xs"
        className={deleteDisabled ? undefined : ROW_ICON_CLASS}
        disabled={deleteDisabled}
        onClick={onRequestDelete}
      />
    </div>
  );
}
