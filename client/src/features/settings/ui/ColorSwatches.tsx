import { TAG_PREFIX_COLOR_KEYS, type TagPrefixColorKey } from "@mimimilli/shared";
import { tagPrefixColorToCss } from "../../../entities/work/tagPrefixColor";
import { I } from "../../../shared/ui/Icon";

export function ColorSwatches({
  value,
  onChange,
  disabled,
}: {
  value: TagPrefixColorKey | null;
  onChange: (color: TagPrefixColorKey | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="色なし"
        aria-pressed={value === null}
        title="色なし"
        disabled={disabled}
        onClick={() => onChange(null)}
        className="grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-full border border-dashed border-line bg-transparent p-0 disabled:cursor-not-allowed"
      >
        {value === null && <I.check size={9} className="text-ink-2" />}
      </button>
      {TAG_PREFIX_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={`色: ${key}`}
          aria-pressed={value === key}
          title={key}
          disabled={disabled}
          onClick={() => onChange(key)}
          style={{ backgroundColor: tagPrefixColorToCss(key) }}
          className="grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-full border border-line-soft p-0 disabled:cursor-not-allowed"
        >
          {value === key && <I.check size={9} className="text-paper-1" />}
        </button>
      ))}
    </div>
  );
}
