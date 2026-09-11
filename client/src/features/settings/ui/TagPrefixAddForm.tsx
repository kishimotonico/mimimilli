import type { TagPrefixColorKey } from "@mimimilli/shared";
import TextInput from "../../../shared/ui/TextInput";
import { ColorSwatches } from "./ColorSwatches";

const COMPACT_INPUT_CLASS = "h-[30px] flex-1 border-line-soft text-secondary text-ink-1";

interface TagPrefixAddFormProps {
  prefix: string;
  label: string;
  color: TagPrefixColorKey | null;
  isMutating: boolean;
  onPrefixChange: (prefix: string) => void;
  onLabelChange: (label: string) => void;
  onColorChange: (color: TagPrefixColorKey | null) => void;
  onSubmit: () => void;
}

export default function TagPrefixAddForm({
  prefix,
  label,
  color,
  isMutating,
  onPrefixChange,
  onLabelChange,
  onColorChange,
  onSubmit,
}: TagPrefixAddFormProps) {
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <TextInput
        value={prefix}
        onChange={(e) => onPrefixChange(e.target.value)}
        aria-label="新しい prefix"
        placeholder="prefix（例: 気分）"
        font="jp"
        className={COMPACT_INPUT_CLASS}
      />
      <TextInput
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        aria-label="表示ラベル"
        placeholder="ラベル（省略可）"
        font="jp"
        className={COMPACT_INPUT_CLASS}
      />
      <ColorSwatches value={color} onChange={onColorChange} disabled={isMutating} />
      <button
        type="submit"
        disabled={!prefix.trim() || isMutating}
        className="h-[30px] cursor-pointer rounded-[6px] border border-line bg-paper-1 px-3 font-sans text-control font-medium whitespace-nowrap text-ink-1 disabled:cursor-not-allowed"
      >
        追加
      </button>
    </form>
  );
}
