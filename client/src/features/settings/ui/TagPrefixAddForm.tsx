import type { TagPrefixColorKey } from "@mimimilli/shared";
import { ColorSwatches } from "./ColorSwatches";

const INPUT_CLASS =
  "h-[30px] min-w-0 flex-1 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 font-jp text-secondary text-ink-1 focus-visible:border-line-strong";

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
      <input
        value={prefix}
        onChange={(e) => onPrefixChange(e.target.value)}
        aria-label="新しい prefix"
        placeholder="prefix（例: 気分）"
        className={INPUT_CLASS}
      />
      <input
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        aria-label="表示ラベル"
        placeholder="ラベル（省略可）"
        className={INPUT_CLASS}
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
