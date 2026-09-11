import type { SmartFolder, SmartFolderRule, TagPrefix } from "@mimimilli/shared";
import { I } from "../../../../shared/ui/Icon";
import Button from "../../../../shared/ui/Button";
import { tagPrefixColorToCss } from "../../../../entities/work/tagPrefixColor";
import {
  formatSmartFolderLengthValue,
  formatSmartFolderOperatorLabel,
  resolveSmartFolderTagChip,
} from "../../model/smartFolderFormat";
import { useSmartFolderRuleMatchCountQuery } from "../../model/useLibraryQueries";

function TagValueChip({
  value,
  tagPrefixes,
  tagSuggestions,
}: {
  value: string;
  tagPrefixes: TagPrefix[];
  tagSuggestions: string[];
}) {
  const { prefixLabel, color, displayValue, isUnknown } = resolveSmartFolderTagChip(
    value,
    tagPrefixes,
    tagSuggestions,
  );

  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-1 border border-line-soft bg-paper-2 text-ink-0"
      title={isUnknown ? `${value}（このタグが付いた作品は現在ありません）` : value}
    >
      {prefixLabel && (
        <span
          className="shrink-0 border-r border-line-soft px-[5px] py-[1px] font-sans text-label font-semibold text-ink-2"
          style={{ color: tagPrefixColorToCss(color) }}
        >
          {prefixLabel}
        </span>
      )}
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap py-[1px] pl-[6px] pr-[3px]">
        {displayValue}
      </span>
      {isUnknown && <I.err size={10} className="mr-[5px] shrink-0 text-[color:var(--r-coral)]" />}
    </span>
  );
}

function RuleValue({
  rule,
  tagPrefixes,
  tagSuggestions,
}: {
  rule: SmartFolderRule;
  tagPrefixes: TagPrefix[];
  tagSuggestions: string[];
}) {
  if (rule.field === "長さ") {
    if (rule.values[0] === undefined) {
      throw new Error("長さルールに値がありません");
    }
    return <span className="val">{formatSmartFolderLengthValue(rule)}</span>;
  }

  return (
    <span className="val flex min-w-0 items-center gap-1">
      {rule.values.map((value, i) => (
        <span key={`${value}-${i}`} className="inline-flex min-w-0 items-center gap-1">
          {i > 0 && <span className="or-sep shrink-0">OR</span>}
          <TagValueChip value={value} tagPrefixes={tagPrefixes} tagSuggestions={tagSuggestions} />
        </span>
      ))}
    </span>
  );
}

export function SmartFolderView({
  sf,
  total,
  tagPrefixes,
  tagSuggestions,
  onEdit,
}: {
  sf: SmartFolder;
  total?: number;
  tagPrefixes: TagPrefix[];
  tagSuggestions: string[];
  onEdit: () => void;
}) {
  // 条件一致（チップ絞り込み前の純粋なルール一致件数）と絞り込み後（total、チップ適用後）を
  // 分けて表示する（TASK-428.11、DRAFT-74 Q-03）
  const ruleMatchCount = useSmartFolderRuleMatchCountQuery(sf.rules, { immediate: true });

  return (
    <div className="mle-prv__body">
      <div className="mll-smart">
        <div className="mll-smart__hd">
          <span className="pill">SMART</span>
          <span className="name">{sf.name}</span>
        </div>
        <div className="mll-smart__rules">
          {sf.rules.length === 0 ? (
            <div style={{ padding: "12px 8px", fontSize: 12, color: "var(--ink-3)" }}>
              ルールなし（すべての作品）
            </div>
          ) : (
            sf.rules.map((rule, i) => (
              <div key={i} className="mll-smart__rule">
                <span className={`conj ${i === 0 ? "first" : ""}`}>
                  {i === 0 ? "WHERE" : rule.conjunction}
                </span>
                <span className="field">
                  <I.filter size={10} /> {rule.field}
                </span>
                <span className="op">{formatSmartFolderOperatorLabel(rule)}</span>
                <RuleValue rule={rule} tagPrefixes={tagPrefixes} tagSuggestions={tagSuggestions} />
              </div>
            ))
          )}
        </div>
        <div className="mll-smart__ft">
          <span className="hits">
            {ruleMatchCount.isCounting ? (
              "条件一致 集計中…"
            ) : ruleMatchCount.total !== undefined ? (
              <>
                条件一致 <b>{ruleMatchCount.total}</b>件
              </>
            ) : null}
            {total != null && (
              <>
                {" "}
                ・ 絞り込み後 <b>{total}</b>件
              </>
            )}
          </span>
          <span className="right">
            <Button variant="ghost" icon={I.cog} onClick={onEdit}>
              条件を編集
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
