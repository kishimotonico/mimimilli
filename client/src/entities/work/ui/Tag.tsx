import { parseTag } from "../model";
import { cn } from "../../../shared/lib/cn";

interface TagProps {
  tag: string;
  onRemove?: () => void;
  onClick?: () => void;
}

const CAT_LABELS: Record<string, string> = {
  cv: "CV",
  サークル: "CIR",
  シリーズ: "SR",
  カテゴリ: "CAT",
  category: "CAT",
  genre: "GNR",
};

const CAT_CLASSES: Record<string, string> = {
  cv: "text-cv",
  サークル: "text-circle",
  シリーズ: "text-series",
  カテゴリ: "text-cat",
  category: "text-cat",
  genre: "text-cat",
};

const TAG_BASE =
  "inline-flex h-5 items-center gap-[3px] whitespace-nowrap rounded-1 bg-paper-2 px-[7px] font-jp text-[10.5px] text-ink-1 hover:bg-paper-3";

const REMOVE_BUTTON =
  "cursor-pointer bg-transparent p-0 text-[13px] leading-none text-ink-3";

export default function Tag({ tag, onRemove, onClick }: TagProps) {
  const parsed = parseTag(tag);

  if (parsed.kind === "flat") {
    return (
      <span className={cn(TAG_BASE, onClick && "cursor-pointer")} onClick={onClick}>
        {parsed.value}
        {onRemove && (
          <button
            className={REMOVE_BUTTON}
            aria-label={`タグ「${parsed.value}」を削除`}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >×</button>
        )}
      </span>
    );
  }

  const catLabel = CAT_LABELS[parsed.prefix] ?? parsed.prefix.toUpperCase().slice(0, 4);
  const catClass = CAT_CLASSES[parsed.prefix] ?? "text-cat";

  return (
    <span className={cn(TAG_BASE, onClick && "cursor-pointer")} onClick={onClick}>
      <span className="font-mono text-[9.5px] uppercase text-ink-3">{catLabel}</span>
      <span className={cn("font-medium", catClass)}>{parsed.value}</span>
      {onRemove && (
        <button
          className={REMOVE_BUTTON}
          aria-label={`タグ「${parsed.value}」を削除`}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >×</button>
      )}
    </span>
  );
}
