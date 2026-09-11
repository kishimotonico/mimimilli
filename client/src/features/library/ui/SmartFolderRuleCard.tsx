import { normalizeTag, type TagPrefix } from "@mimimilli/shared";
import type { SmartFolderEditorRule } from "../model/smartFolderEditor";
import {
  formatSmartFolderLengthValue,
  formatSmartFolderOperatorLabel,
  resolveSmartFolderTagChip,
} from "../model/smartFolderFormat";
import { cn } from "../../../shared/lib/cn";
import { tagPrefixColorToCss } from "../../../entities/work/tagPrefixColor";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import TagCombobox, { type TagComboboxHandle } from "../../../shared/ui/TagCombobox";

const inputClass =
  "h-8 rounded-[6px] border border-line bg-paper-1 px-2.5 font-jp text-body text-ink-0 focus-visible:border-line-strong";

// エディタと結果バナー（SmartFolderView）で列位置を揃えるための固定幅
const CONJ_WIDTH_CLASS = "w-[92px]";
const OP_WIDTH_CLASS = "w-[76px]";

function DurationInput({
  rule,
  onChange,
}: {
  rule: Extract<SmartFolderEditorRule, { field: "長さ" }>;
  onChange: (seconds: string) => void;
}) {
  const totalSeconds = /^\d+$/.test(rule.values[0]) ? Number(rule.values[0]) : 0;
  const parts = {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };

  const setPart = (part: keyof typeof parts, rawValue: string) => {
    const value = Math.max(0, Number.parseInt(rawValue || "0", 10) || 0);
    const next = { ...parts, [part]: value };
    onChange(String(next.hours * 3600 + next.minutes * 60 + next.seconds));
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {(
          [
            ["hours", "時間"],
            ["minutes", "分"],
            ["seconds", "秒"],
          ] as const
        ).map(([part, label]) => (
          <label key={part} className="flex items-center gap-1 font-jp text-secondary text-ink-2">
            <input
              type="number"
              min={0}
              value={parts[part]}
              aria-label={`長さ（${label}）`}
              className={`${inputClass} w-[68px] font-mono`}
              onChange={(event) => setPart(part, event.target.value)}
            />
            {label}
          </label>
        ))}
      </div>
      <span className="font-jp text-caption text-ink-2">{formatSmartFolderLengthValue(rule)}</span>
    </div>
  );
}

interface SmartFolderRuleCardProps {
  rule: SmartFolderEditorRule;
  index: number;
  error: string | undefined;
  tagSuggestions: string[];
  tagPrefixes: TagPrefix[];
  cardRef: (el: HTMLDivElement | null) => void;
  tagComboboxRef: (el: TagComboboxHandle | null) => void;
  onFieldChange: (field: SmartFolderEditorRule["field"]) => void;
  onRemove: () => void;
  onUpdate: (update: (rule: SmartFolderEditorRule) => SmartFolderEditorRule) => void;
}

export default function SmartFolderRuleCard({
  rule,
  index,
  error,
  tagSuggestions,
  tagPrefixes,
  cardRef,
  tagComboboxRef,
  onFieldChange,
  onRemove,
  onUpdate,
}: SmartFolderRuleCardProps) {
  return (
    <div
      ref={cardRef}
      data-rule-id={rule.id}
      tabIndex={-1}
      aria-invalid={Boolean(error)}
      className={cn(
        "rounded-[6px] border border-line-soft bg-paper-0 p-2.5 focus:outline-none",
        error && "border-[var(--r-coral)] bg-[oklch(97%_0.02_25)]",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {index === 0 ? (
          <span
            className={`${CONJ_WIDTH_CLASS} text-center font-mono text-label font-bold text-ink-4`}
          >
            WHERE
          </span>
        ) : (
          <select
            aria-label={`${index + 1}件目の条件の組み合わせ`}
            value={rule.conjunction}
            className={`${inputClass} ${CONJ_WIDTH_CLASS} font-mono text-label font-bold`}
            onChange={(event) => {
              const conjunction = event.target.value;
              onUpdate((current) =>
                current.field === "長さ"
                  ? { ...current, conjunction: conjunction as "AND" | "OR" }
                  : { ...current, conjunction: conjunction as "AND" | "OR" | "AND NOT" },
              );
            }}
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
            {rule.field === "タグ" && <option value="AND NOT">AND NOT</option>}
          </select>
        )}

        <select
          aria-label={`${index + 1}件目の条件のフィールド`}
          value={rule.field}
          className={`${inputClass} w-[104px] font-sans`}
          onChange={(event) => onFieldChange(event.target.value as SmartFolderEditorRule["field"])}
        >
          <option value="タグ">タグ</option>
          <option value="長さ">長さ</option>
        </select>

        <span className={`${OP_WIDTH_CLASS} text-center font-jp text-secondary text-ink-2`}>
          {formatSmartFolderOperatorLabel(rule)}
        </span>

        <IconButton
          icon={I.x}
          label={`${index + 1}件目の条件を削除`}
          size="sm"
          className="ml-auto"
          onClick={onRemove}
        />
      </div>

      <div data-rule-value className="mt-2 border-t border-line-soft pt-2">
        {rule.field === "タグ" ? (
          <div className="flex flex-col gap-2">
            {rule.values.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {rule.values.map((value) => {
                  const { prefixLabel, color, displayValue, isUnknown } = resolveSmartFolderTagChip(
                    value,
                    tagPrefixes,
                    tagSuggestions,
                  );
                  return (
                    <span
                      key={value}
                      className="inline-flex h-7 min-w-0 items-center gap-1 rounded-[5px] border border-line-soft bg-paper-2 pl-2 font-jp text-secondary text-ink-0"
                      title={
                        isUnknown ? `${value}（このタグが付いた作品は現在ありません）` : undefined
                      }
                    >
                      {prefixLabel && (
                        <span
                          className="shrink-0 font-mono text-label font-semibold uppercase text-ink-2"
                          style={{ color: tagPrefixColorToCss(color) }}
                        >
                          {prefixLabel}
                        </span>
                      )}
                      <span className="max-w-[260px] truncate">{displayValue}</span>
                      {isUnknown && (
                        <I.err size={11} className="shrink-0 text-[color:var(--r-coral)]" />
                      )}
                      <IconButton
                        icon={I.x}
                        label={`${value}を削除`}
                        size="sm"
                        onClick={() =>
                          onUpdate((current) => {
                            if (current.field !== "タグ") return current;
                            return {
                              ...current,
                              values: current.values.filter((tag) => tag !== value),
                            };
                          })
                        }
                      />
                    </span>
                  );
                })}
              </div>
            )}
            <TagCombobox
              ref={tagComboboxRef}
              suggestions={tagSuggestions}
              excludeTags={rule.values}
              width="full"
              placeholder="タグ名を入力して追加"
              label={`${index + 1}件目の条件に追加するタグ`}
              canCreate={(tag) => normalizeTag(tag) !== null}
              createLabel="該当タグなし"
              onSelect={(tag) =>
                onUpdate((current) => {
                  if (current.field !== "タグ") return current;
                  return { ...current, values: [...current.values, tag] };
                })
              }
            />
            <span className="font-jp text-caption text-ink-2">
              複数のタグは、いずれかを含む作品に一致します（OR）
            </span>
          </div>
        ) : (
          <DurationInput
            rule={rule}
            onChange={(seconds) =>
              onUpdate((current) =>
                current.field === "長さ" ? { ...current, values: [seconds] } : current,
              )
            }
          />
        )}
        {error && (
          <span className="mt-1.5 block font-jp text-secondary text-[var(--r-coral)]">{error}</span>
        )}
      </div>
    </div>
  );
}
