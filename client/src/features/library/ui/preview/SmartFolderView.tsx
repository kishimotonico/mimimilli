import { parseTag, type SmartFolder, type SmartFolderRule, type WorkSummary } from "@mimikago/shared";
import { I } from "../../../../shared/ui/Icon";
import { formatDuration } from "./format";

const TAG_PREFIX_LABEL: Record<string, string> = {
  circle: "サークル",
  cv: "CV",
  series: "シリーズ",
  cat: "カテゴリ",
  genre: "ジャンル",
  "サークル": "サークル",
  "シリーズ": "シリーズ",
  "カテゴリ": "カテゴリ",
};

function formatRuleDuration(value: string): string {
  return formatDuration(Number(value));
}

function TagValueChip({ value }: { value: string }) {
  const tag = parseTag(value);
  const prefixLabel = tag.kind === "annotated" ? (TAG_PREFIX_LABEL[tag.prefix] ?? tag.prefix) : null;

  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center overflow-hidden rounded-1 border border-line-soft bg-paper-2 text-ink-0"
      title={value}
    >
      {prefixLabel && (
        <span className="shrink-0 border-r border-line-soft px-[5px] py-[1px] font-sans text-[9px] font-semibold text-ink-3">
          {prefixLabel}
        </span>
      )}
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-[6px] py-[1px]">
        {tag.kind === "annotated" ? tag.value : tag.raw}
      </span>
    </span>
  );
}

function RuleValue({ rule }: { rule: SmartFolderRule }) {
  if (rule.field === "長さ") {
    return <span className="val">{formatRuleDuration(rule.values[0])}</span>;
  }

  return (
    <span className="val flex min-w-0 items-center gap-1">
      {rule.values.map((value, i) => (
        <span key={`${value}-${i}`} className="inline-flex min-w-0 items-center gap-1">
          {i > 0 && <span className="shrink-0 font-mono text-[9px] font-semibold text-ink-4">OR</span>}
          <TagValueChip value={value} />
        </span>
      ))}
    </span>
  );
}

export function SmartFolderView({ sf, works }: { sf: SmartFolder; works: WorkSummary[] }) {
  return (
    <div className="mle-prv__body">
      <div className="mll-smart">
        <div className="mll-smart__hd">
          <span className="pill">SMART</span>
          <span className="name">{sf.name}</span>
        </div>
        <div className="mll-smart__rules">
          {sf.rules.length === 0 ? (
            <div style={{ padding: "12px 8px", fontSize: 12, color: "var(--ink-3)" }}>ルールなし（すべての作品）</div>
          ) : sf.rules.map((rule, i) => (
            <div key={i} className="mll-smart__rule">
              <span className={`conj ${i === 0 ? "first" : ""}`}>{i === 0 ? "WHERE" : rule.conjunction}</span>
              <span className="field"><I.filter size={10} /> {rule.field}</span>
              <span className="op">{rule.operator}</span>
              <RuleValue rule={rule} />
            </div>
          ))}
        </div>
        <button
          className="mll-smart__add !cursor-not-allowed !text-ink-4 hover:!bg-transparent hover:!text-ink-4"
          disabled
          title="近日実装"
        >
          <I.add size={11} /> 条件を追加
        </button>
        <div className="mll-smart__ft">
          <span className="hits"><b>{works.length}</b> 件マッチ</span>
        </div>
      </div>
    </div>
  );
}
