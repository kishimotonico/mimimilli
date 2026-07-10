import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { SmartFolder, SmartFolderCreate } from "@mimimilli/shared";
import {
  addSmartFolderRule,
  changeSmartFolderRuleField,
  createSmartFolderDraft,
  removeSmartFolderRule,
  updateSmartFolderRule,
  validateSmartFolderDraft,
  type SmartFolderEditorErrors,
  type SmartFolderEditorRule,
} from "../model/smartFolderEditor";
import Button from "../../../shared/ui/Button";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import TagCombobox from "../../../shared/ui/TagCombobox";

interface SmartFolderEditorModalProps {
  folder: SmartFolder | null;
  tagSuggestions: string[];
  isSaving: boolean;
  saveError: string | null;
  onClose: () => void;
  onSave: (input: SmartFolderCreate) => void;
}

const inputClass =
  "h-8 rounded-[6px] border border-line bg-paper-1 px-2.5 font-jp text-[12px] text-ink-0 focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc-soft";

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
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {(
        [
          ["hours", "時間"],
          ["minutes", "分"],
          ["seconds", "秒"],
        ] as const
      ).map(([part, label]) => (
        <label key={part} className="flex items-center gap-1 font-jp text-[11px] text-ink-2">
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
  );
}

export default function SmartFolderEditorModal({
  folder,
  tagSuggestions,
  isSaving,
  saveError,
  onClose,
  onSave,
}: SmartFolderEditorModalProps) {
  const [draft, setDraft] = useState(() => createSmartFolderDraft(folder ?? undefined));
  const [errors, setErrors] = useState<SmartFolderEditorErrors>({ ruleValues: {} });
  const nextRuleId = useRef(draft.rules.length);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  const updateRule = (
    id: string,
    update: (rule: SmartFolderEditorRule) => SmartFolderEditorRule,
  ) => {
    setDraft((current) => updateSmartFolderRule(current, id, update));
    setErrors((current) => {
      const { [id]: _removed, ...ruleValues } = current.ruleValues;
      return { ...current, ruleValues };
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateSmartFolderDraft(draft);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({ ruleValues: {} });
    onSave({ ...result.data, sort: folder?.sort ?? result.data.sort });
  };

  const trapFocus = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Tab") return;
    const focusable = [
      ...(modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []),
    ].filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  /* oxlint-disable jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-element-interactions -- デザインシステムのz-index階層に合わせたform製モーダル。キーボードイベントはフォーカストラップに使う。 */
  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- モーダル背景はクリックで閉じ、Escapeも上のeffectで処理する。 */}
      <div
        className="fixed inset-0 z-40 bg-[oklch(20%_0.020_70_/_0.3)]"
        onClick={() => !isSaving && onClose()}
      />
      <form
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="smart-folder-editor-title"
        onSubmit={handleSubmit}
        onKeyDown={trapFocus}
        className="fixed left-1/2 top-1/2 z-[41] flex max-h-[min(760px,calc(100vh-32px))] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 font-jp shadow-pop"
      >
        <div className="flex shrink-0 items-center border-b border-line-soft px-[18px] py-[14px]">
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[9px] font-semibold tracking-[0.08em] text-acc-ink">
              SMART
            </span>
            <h2
              id="smart-folder-editor-title"
              className="mt-0.5 font-sans text-[14px] font-semibold text-ink-0"
            >
              {folder ? "スマートフォルダーを編集" : "スマートフォルダーを作成"}
            </h2>
          </div>
          <IconButton icon={I.x} label="閉じる" size="sm" disabled={isSaving} onClick={onClose} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-[18px] py-4">
          <label className="flex flex-col gap-1.5 font-sans text-[11px] font-medium text-ink-1">
            名前
            <input
              ref={nameInputRef}
              value={draft.name}
              aria-invalid={Boolean(errors.name)}
              className={`${inputClass} w-full`}
              placeholder="例: 長時間 ASMR"
              onChange={(event) => {
                setDraft((current) => ({ ...current, name: event.target.value }));
                setErrors((current) => ({ ...current, name: undefined }));
              }}
            />
            {errors.name && (
              <span className="text-[11px] text-[var(--r-coral)]">{errors.name}</span>
            )}
          </label>

          <section aria-labelledby="smart-folder-rules-title" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3
                id="smart-folder-rules-title"
                className="font-sans text-[11px] font-medium text-ink-1"
              >
                条件
              </h3>
              <span className="font-jp text-[10px] text-ink-3">上から順に評価します</span>
            </div>

            <div className="mll-smart__rules gap-2 p-2.5">
              {draft.rules.map((rule, index) => (
                <div
                  key={rule.id}
                  className="rounded-[6px] border border-line-soft bg-paper-0 p-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {index === 0 ? (
                      <span className="w-[76px] text-center font-mono text-[10px] font-bold text-ink-4">
                        WHERE
                      </span>
                    ) : (
                      <select
                        aria-label={`${index + 1}件目の条件の組み合わせ`}
                        value={rule.conjunction}
                        className={`${inputClass} w-[92px] font-mono text-[10px] font-bold`}
                        onChange={(event) => {
                          const conjunction = event.target.value;
                          updateRule(rule.id, (current) =>
                            current.field === "長さ"
                              ? {
                                  ...current,
                                  conjunction: conjunction as "AND" | "OR",
                                }
                              : {
                                  ...current,
                                  conjunction: conjunction as "AND" | "OR" | "AND NOT",
                                },
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
                      onChange={(event) => {
                        setDraft((current) =>
                          changeSmartFolderRuleField(
                            current,
                            rule.id,
                            event.target.value as SmartFolderEditorRule["field"],
                          ),
                        );
                        setErrors((current) => {
                          const { [rule.id]: _removed, ...ruleValues } = current.ruleValues;
                          return { ...current, ruleValues };
                        });
                      }}
                    >
                      <option value="タグ">タグ</option>
                      <option value="長さ">長さ</option>
                    </select>

                    <select
                      aria-label={`${index + 1}件目の条件の演算子`}
                      value={rule.operator}
                      disabled
                      className={`${inputClass} w-[68px] cursor-not-allowed font-mono text-ink-2`}
                    >
                      <option value={rule.operator}>{rule.operator}</option>
                    </select>

                    <IconButton
                      icon={I.x}
                      label={`${index + 1}件目の条件を削除`}
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        setDraft((current) => removeSmartFolderRule(current, rule.id));
                        setErrors((current) => {
                          const { [rule.id]: _removed, ...ruleValues } = current.ruleValues;
                          return { ...current, ruleValues };
                        });
                      }}
                    />
                  </div>

                  <div className="mt-2 border-t border-line-soft pt-2">
                    {rule.field === "タグ" ? (
                      <div className="flex flex-col gap-2">
                        {rule.values.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {rule.values.map((value) => (
                              <span
                                key={value}
                                className="inline-flex h-7 min-w-0 items-center gap-1 rounded-[5px] border border-line-soft bg-paper-2 pl-2 font-jp text-[11px] text-ink-0"
                              >
                                <span className="max-w-[260px] truncate" title={value}>
                                  {value}
                                </span>
                                <IconButton
                                  icon={I.x}
                                  label={`${value}を削除`}
                                  size="sm"
                                  onClick={() =>
                                    updateRule(rule.id, (current) => {
                                      if (current.field !== "タグ") return current;
                                      return {
                                        ...current,
                                        values: current.values.filter((tag) => tag !== value),
                                      };
                                    })
                                  }
                                />
                              </span>
                            ))}
                          </div>
                        )}
                        <TagCombobox
                          suggestions={tagSuggestions}
                          excludeTags={rule.values}
                          width="full"
                          placeholder="タグ名を入力して追加"
                          label={`${index + 1}件目の条件に追加するタグ`}
                          onSelect={(tag) =>
                            updateRule(rule.id, (current) => {
                              if (current.field !== "タグ") return current;
                              return { ...current, values: [...current.values, tag] };
                            })
                          }
                        />
                        <span className="font-jp text-[10px] text-ink-3">
                          複数のタグは、いずれかを含む作品に一致します（OR）
                        </span>
                      </div>
                    ) : (
                      <DurationInput
                        rule={rule}
                        onChange={(seconds) =>
                          updateRule(rule.id, (current) =>
                            current.field === "長さ" ? { ...current, values: [seconds] } : current,
                          )
                        }
                      />
                    )}
                    {errors.ruleValues[rule.id] && (
                      <span className="mt-1.5 block font-jp text-[11px] text-[var(--r-coral)]">
                        {errors.ruleValues[rule.id]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="ghost"
              icon={I.add}
              className="self-start border border-dashed border-line-strong bg-transparent"
              onClick={() => {
                const id = `rule-${nextRuleId.current++}`;
                setDraft((current) => addSmartFolderRule(current, id));
              }}
            >
              条件を追加
            </Button>
            {draft.rules.length === 0 && (
              <span className="font-jp text-[11px] text-ink-3">
                条件なし: すべての作品に一致します
              </span>
            )}
          </section>

          {saveError && (
            <div
              role="alert"
              className="rounded-[6px] border border-[var(--r-coral)] bg-paper-0 px-3 py-2 text-[11px] text-[var(--r-coral)]"
            >
              {saveError}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-line-soft px-[18px] py-3">
          <Button variant="quiet" disabled={isSaving} onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? "保存中…" : folder ? "変更を保存" : "作成"}
          </Button>
        </div>
      </form>
    </>
  );
}
