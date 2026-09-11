import { useRef, useState, type FormEvent } from "react";
import {
  normalizeTag,
  type SmartFolder,
  type SmartFolderCreate,
  type SortId,
  type TagPrefix,
} from "@mimimilli/shared";
import {
  addSmartFolderRule,
  changeSmartFolderRuleField,
  createSmartFolderDraft,
  removeSmartFolderRule,
  updateSmartFolderRule,
  validateSmartFolderDraft,
  validateSmartFolderDraftRules,
  type SmartFolderEditorErrors,
  type SmartFolderEditorRule,
} from "../model/smartFolderEditor";
import {
  formatSmartFolderLengthValue,
  formatSmartFolderOperatorLabel,
  resolveSmartFolderTagChip,
} from "../model/smartFolderFormat";
import { useSmartFolderRuleMatchCountQuery } from "../model/useLibraryQueries";
import { SORT_OPTIONS } from "../../../entities/library/types";
import { cn } from "../../../shared/lib/cn";
import { tagPrefixColorToCss } from "../../../entities/work/tagPrefixColor";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import TagCombobox, { type TagComboboxHandle } from "../../../shared/ui/TagCombobox";
import { useDialogModal } from "../../../shared/ui/useDialogModal";

interface SmartFolderEditorModalProps {
  folder: SmartFolder | null;
  tagSuggestions: string[];
  tagPrefixes: TagPrefix[];
  isSaving: boolean;
  saveError: string | null;
  isDeleting: boolean;
  deleteError: string | null;
  onClose: () => void;
  onSave: (input: SmartFolderCreate) => void;
  /** 編集時のみ渡される。未指定（作成モード）では削除操作を表示しない */
  onDelete?: () => void;
}

const inputClass =
  "h-8 rounded-[6px] border border-line bg-paper-1 px-2.5 font-jp text-body text-ink-0 focus:border-acc";

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

export default function SmartFolderEditorModal({
  folder,
  tagSuggestions,
  tagPrefixes,
  isSaving,
  saveError,
  isDeleting,
  deleteError,
  onClose,
  onSave,
  onDelete,
}: SmartFolderEditorModalProps) {
  const [draft, setDraft] = useState(() => createSmartFolderDraft(folder ?? undefined));
  const [errors, setErrors] = useState<SmartFolderEditorErrors>({ ruleValues: {} });
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const nextRuleId = useRef(draft.rules.length);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const ruleCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tagComboboxRefs = useRef<Record<string, TagComboboxHandle | null>>({});
  const isBusy = isSaving || isDeleting;

  const rulesResult = validateSmartFolderDraftRules(draft.rules);
  const matchCount = useSmartFolderRuleMatchCountQuery(
    rulesResult.success ? rulesResult.rules : null,
  );

  const errorCount = Object.keys(errors.ruleValues).length + (errors.name ? 1 : 0);

  // 保存中・削除中はEscapeでもbackdropクリックでも閉じない（既存挙動を維持）
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({
    onClose: () => {
      if (!isBusy) onClose();
    },
    initialFocusRef: nameInputRef,
  });

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

  const focusFirstInvalid = (invalidErrors: SmartFolderEditorErrors) => {
    if (invalidErrors.name) {
      nameInputRef.current?.scrollIntoView({ block: "center" });
      nameInputRef.current?.focus();
      return;
    }
    const firstInvalidRuleId = draft.rules.find((rule) => invalidErrors.ruleValues[rule.id])?.id;
    if (firstInvalidRuleId === undefined) return;
    const card = ruleCardRefs.current[firstInvalidRuleId];
    if (!card) return;
    card.scrollIntoView({ block: "center" });
    (card.querySelector<HTMLElement>("[data-rule-value] input") ?? card).focus();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    // 保存前に、タグ入力欄に残っている未確定文字列をEnterと同じ規則で確定する。
    // 候補に一致しない入力は破棄せず、入力欄へ戻してエラーにする。
    let workingDraft = draft;
    const pendingInputErrors: SmartFolderEditorErrors["ruleValues"] = {};
    for (const rule of workingDraft.rules) {
      if (rule.field !== "タグ") continue;
      const handle = tagComboboxRefs.current[rule.id];
      if (!handle) continue;
      const commitResult = handle.commitPendingInput();
      if (commitResult.status === "invalid") {
        pendingInputErrors[rule.id] = "入力中のタグを確定してください";
        continue;
      }
      if (commitResult.value !== null) {
        const value = commitResult.value;
        workingDraft = updateSmartFolderRule(workingDraft, rule.id, (current) =>
          current.field === "タグ" ? { ...current, values: [...current.values, value] } : current,
        );
      }
    }

    if (Object.keys(pendingInputErrors).length > 0) {
      setDraft(workingDraft);
      const nextErrors: SmartFolderEditorErrors = { ruleValues: pendingInputErrors };
      setErrors(nextErrors);
      focusFirstInvalid(nextErrors);
      return;
    }

    const result = validateSmartFolderDraft(workingDraft);
    if (!result.success) {
      setDraft(workingDraft);
      setErrors(result.errors);
      focusFirstInvalid(result.errors);
      return;
    }
    setDraft(workingDraft);
    setErrors({ ruleValues: {} });
    onSave(result.data);
  };

  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックで閉じる。EscapeはonCancel（useDialogModal）で処理する。 */}
      <dialog
        ref={dialogRef}
        aria-labelledby="smart-folder-editor-title"
        onCancel={handleCancel}
        onClick={(e) => handleBackdropClick(e)}
        className="m-auto w-[min(720px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
      >
        <form
          onSubmit={handleSubmit}
          className="flex max-h-[min(760px,calc(100vh-32px))] min-h-0 flex-col overflow-hidden"
        >
          <div className="flex shrink-0 items-center border-b border-line-soft px-[18px] py-[14px]">
            <div className="min-w-0 flex-1">
              <span className="font-mono text-label font-semibold tracking-[0.08em] text-acc-ink">
                SMART
              </span>
              <h2
                id="smart-folder-editor-title"
                className="mt-0.5 font-sans text-[14px] font-semibold text-ink-0"
              >
                {folder ? "スマートフォルダーを編集" : "スマートフォルダーを作成"}
              </h2>
            </div>
            <IconButton icon={I.x} label="閉じる" size="sm" disabled={isBusy} onClick={onClose} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-[18px] py-4">
            <label className="flex flex-col gap-1.5 font-sans text-label font-medium text-ink-1">
              名前
              <input
                ref={nameInputRef}
                value={draft.name}
                aria-invalid={Boolean(errors.name)}
                className={cn(inputClass, "w-full", errors.name && "border-[var(--r-coral)]")}
                placeholder="例: 長時間 ASMR"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, name: event.target.value }));
                  setErrors((current) => ({ ...current, name: undefined }));
                }}
              />
              {errors.name && (
                <span className="text-secondary text-[var(--r-coral)]">{errors.name}</span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 font-sans text-label font-medium text-ink-1">
              並び順
              <select
                value={draft.sort}
                className={`${inputClass} w-[200px] font-jp`}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, sort: event.target.value as SortId }))
                }
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <section aria-labelledby="smart-folder-rules-title" className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h3
                  id="smart-folder-rules-title"
                  className="font-sans text-label font-medium text-ink-1"
                >
                  条件
                </h3>
                <span className="font-jp text-caption text-ink-2">上から順に評価します</span>
                <span className="ml-auto font-mono text-mono text-ink-2">
                  {matchCount.isCounting ? (
                    "集計中…"
                  ) : matchCount.total !== undefined ? (
                    <>
                      条件一致 <b className="text-acc-ink">{matchCount.total}</b>件
                    </>
                  ) : null}
                </span>
              </div>

              <div className="mll-smart__rules gap-2 p-2.5">
                {draft.rules.map((rule, index) => {
                  const ruleError = errors.ruleValues[rule.id];
                  return (
                    <div
                      key={rule.id}
                      ref={(el) => {
                        ruleCardRefs.current[rule.id] = el;
                      }}
                      data-rule-id={rule.id}
                      tabIndex={-1}
                      aria-invalid={Boolean(ruleError)}
                      className={cn(
                        "rounded-[6px] border border-line-soft bg-paper-0 p-2.5 focus:outline-none",
                        ruleError && "border-[var(--r-coral)] bg-[oklch(97%_0.02_25)]",
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

                        <span
                          className={`${OP_WIDTH_CLASS} text-center font-jp text-secondary text-ink-2`}
                        >
                          {formatSmartFolderOperatorLabel(rule)}
                        </span>

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

                      <div data-rule-value className="mt-2 border-t border-line-soft pt-2">
                        {rule.field === "タグ" ? (
                          <div className="flex flex-col gap-2">
                            {rule.values.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {rule.values.map((value) => {
                                  const { prefixLabel, color, displayValue, isUnknown } =
                                    resolveSmartFolderTagChip(value, tagPrefixes, tagSuggestions);
                                  return (
                                    <span
                                      key={value}
                                      className="inline-flex h-7 min-w-0 items-center gap-1 rounded-[5px] border border-line-soft bg-paper-2 pl-2 font-jp text-secondary text-ink-0"
                                      title={
                                        isUnknown
                                          ? `${value}（このタグが付いた作品は現在ありません）`
                                          : undefined
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
                                        <I.err
                                          size={11}
                                          className="shrink-0 text-[color:var(--r-coral)]"
                                        />
                                      )}
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
                                  );
                                })}
                              </div>
                            )}
                            <TagCombobox
                              ref={(el) => {
                                tagComboboxRefs.current[rule.id] = el;
                              }}
                              suggestions={tagSuggestions}
                              excludeTags={rule.values}
                              width="full"
                              placeholder="タグ名を入力して追加"
                              label={`${index + 1}件目の条件に追加するタグ`}
                              canCreate={(tag) => normalizeTag(tag) !== null}
                              createLabel="該当タグなし"
                              onSelect={(tag) =>
                                updateRule(rule.id, (current) => {
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
                              updateRule(rule.id, (current) =>
                                current.field === "長さ"
                                  ? { ...current, values: [seconds] }
                                  : current,
                              )
                            }
                          />
                        )}
                        {ruleError && (
                          <span className="mt-1.5 block font-jp text-secondary text-[var(--r-coral)]">
                            {ruleError}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                <span className="font-jp text-secondary text-ink-2">
                  条件なし: すべての作品に一致します
                </span>
              )}
            </section>

            {errorCount > 0 && (
              <div
                role="alert"
                className="mll-selectable rounded-[6px] border border-[var(--r-coral)] bg-paper-0 px-3 py-2 text-secondary text-[var(--r-coral)]"
              >
                入力に不備があります（{errorCount}件）
              </div>
            )}
            {saveError && (
              <div
                role="alert"
                className="mll-selectable rounded-[6px] border border-[var(--r-coral)] bg-paper-0 px-3 py-2 text-secondary text-[var(--r-coral)]"
              >
                {saveError}
              </div>
            )}
            {deleteError && (
              <div
                role="alert"
                className="mll-selectable rounded-[6px] border border-[var(--r-coral)] bg-paper-0 px-3 py-2 text-secondary text-[var(--r-coral)]"
              >
                {deleteError}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-line-soft px-[18px] py-3">
            {onDelete && (
              <Button variant="ghost" disabled={isBusy} onClick={() => setIsConfirmingDelete(true)}>
                {isDeleting ? "削除中…" : "このスマートフォルダーを削除"}
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="quiet" disabled={isBusy} onClick={onClose}>
                キャンセル
              </Button>
              <Button variant="primary" type="submit" disabled={isBusy}>
                {isSaving ? "保存中…" : folder ? "変更を保存" : "作成"}
              </Button>
            </div>
          </div>
        </form>
      </dialog>
      {isConfirmingDelete && onDelete && (
        <ConfirmDialog
          title="スマートフォルダーを削除しますか？"
          message={`「${folder?.name ?? ""}」を削除します。条件だけが消え、作品は削除されません。`}
          confirmLabel="削除"
          onCancel={() => setIsConfirmingDelete(false)}
          onConfirm={() => {
            setIsConfirmingDelete(false);
            onDelete();
          }}
        />
      )}
    </>
  );
}
