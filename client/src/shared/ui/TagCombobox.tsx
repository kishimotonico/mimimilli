import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";

export type TagComboboxOption =
  | { kind: "suggestion"; value: string }
  | { kind: "create"; value: string };

export interface GetTagComboboxOptionsParams {
  excludeTags?: string[];
  limit?: number;
  canCreate?: (tag: string) => boolean;
}

const DEFAULT_LIMIT = 8;

function normalizeTag(tag: string): string {
  return tag.trim().toLocaleLowerCase();
}

export function getTagComboboxOptions(
  input: string,
  suggestions: string[],
  {
    excludeTags = [],
    limit = DEFAULT_LIMIT,
    canCreate = () => true,
  }: GetTagComboboxOptionsParams = {},
): TagComboboxOption[] {
  const query = input.trim();
  if (query.length === 0) return [];

  const normalizedQuery = normalizeTag(query);
  const excluded = new Set(excludeTags.map(normalizeTag));
  const seen = new Set<string>();
  const matchedSuggestions: TagComboboxOption[] = [];
  let hasExactMatch = excluded.has(normalizedQuery);

  for (const suggestion of suggestions) {
    const tag = suggestion.trim();
    if (tag.length === 0) continue;

    const normalized = normalizeTag(tag);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    if (normalized === normalizedQuery) hasExactMatch = true;
    if (excluded.has(normalized)) continue;
    if (!normalized.includes(normalizedQuery)) continue;

    if (matchedSuggestions.length < limit) {
      matchedSuggestions.push({ kind: "suggestion", value: tag });
    }
  }

  if (!hasExactMatch && canCreate(query)) {
    return [...matchedSuggestions, { kind: "create", value: query }];
  }

  return matchedSuggestions;
}

export interface TagComboboxProps {
  suggestions: string[];
  excludeTags?: string[];
  disabled?: boolean;
  focusOnMount?: boolean;
  placeholder?: string;
  label?: string;
  width?: number;
  canCreate?: (tag: string) => boolean;
  onSelect: (tag: string) => void;
  onCancel?: () => void;
}

export default function TagCombobox({
  suggestions,
  excludeTags = [],
  disabled = false,
  focusOnMount = false,
  placeholder = "タグを追加",
  label = "追加するタグ",
  width = 220,
  canCreate,
  onSelect,
  onCancel,
}: TagComboboxProps) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const options = useMemo(
    () => getTagComboboxOptions(input, suggestions, { excludeTags, canCreate }),
    [canCreate, excludeTags, input, suggestions],
  );
  const isExpanded = isOpen && options.length > 0;
  const activeOption = isExpanded ? options[activeIndex] : null;
  const activeOptionId = activeOption ? `${baseId}-option-${activeIndex}` : undefined;

  const openWithInput = (nextInput: string) => {
    setInput(nextInput);
    setIsOpen(nextInput.trim().length > 0);
    setActiveIndex(0);
  };

  const commitOption = (option: TagComboboxOption) => {
    onSelect(option.value);
    setInput("");
    setIsOpen(false);
    setActiveIndex(0);
  };

  useEffect(() => {
    if (!focusOnMount || disabled) return;

    const frameId = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(frameId);
  }, [focusOnMount, disabled]);

  /* oxlint-disable jsx-a11y/prefer-tag-over-role -- Custom combobox needs ARIA listbox/option semantics and cannot use native select/datalist without changing tag creation behavior. */
  return (
    <div className="relative" style={{ width }}>
      <input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={isExpanded}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        disabled={disabled}
        value={input}
        placeholder={placeholder}
        className={cn(
          "h-8 w-full rounded-[6px] border border-line bg-paper-1 px-2.5 font-jp text-[12px] text-ink-0",
          "placeholder:text-ink-4 focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc-soft",
          disabled && "cursor-not-allowed text-ink-4",
        )}
        onChange={(event) => openWithInput(event.target.value)}
        onFocus={() => setIsOpen(input.trim().length > 0)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (options.length === 0) return;
            setIsOpen(true);
            setActiveIndex((current) => (current + 1) % options.length);
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (options.length === 0) return;
            setIsOpen(true);
            setActiveIndex((current) => (current - 1 + options.length) % options.length);
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            if (activeOption) commitOption(activeOption);
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setIsOpen(false);
            onCancel?.();
          }
        }}
      />

      {isExpanded && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-[6px] border border-line bg-paper-1 py-1 shadow-pop"
        >
          {options.map((option, index) => {
            const isActive = index === activeIndex;
            const optionId = `${baseId}-option-${index}`;
            return (
              <button
                key={`${option.kind}:${option.value}`}
                id={optionId}
                role="option"
                type="button"
                aria-selected={isActive}
                className={cn(
                  "flex min-h-7 w-full items-center px-2.5 text-left font-jp text-[12px] text-ink-1",
                  "hover:bg-paper-2 focus:bg-paper-2 focus:outline-none",
                  isActive && "bg-acc-soft text-acc-ink",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitOption(option)}
              >
                {option.kind === "create" ? (
                  <span><span className="font-medium">"{option.value}"</span> を新規作成</span>
                ) : (
                  <span>{option.value}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
  /* oxlint-enable jsx-a11y/prefer-tag-over-role */
}
