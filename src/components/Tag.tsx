import { parseTag } from "../types";

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
  cv: "cv",
  サークル: "circle",
  シリーズ: "series",
  カテゴリ: "cat",
  category: "cat",
  genre: "cat",
};

export default function Tag({ tag, onRemove, onClick }: TagProps) {
  const parsed = parseTag(tag);

  if (parsed.kind === "flat") {
    return (
      <span className="ml-tag flat" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
        {parsed.value}
        {onRemove && (
          <button
            className="ml-x"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >×</button>
        )}
      </span>
    );
  }

  const catLabel = CAT_LABELS[parsed.prefix] ?? parsed.prefix.toUpperCase().slice(0, 4);
  const catClass = CAT_CLASSES[parsed.prefix] ?? "cat";

  return (
    <span className={`ml-tag is-anno ${catClass}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <span className="ml-tag__cat">{catLabel}</span>
      <span className="ml-tag__val">{parsed.value}</span>
      {onRemove && (
        <button
          className="ml-x"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >×</button>
      )}
    </span>
  );
}
