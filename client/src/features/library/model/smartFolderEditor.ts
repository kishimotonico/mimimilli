import { dedupeTags, normalizeTags, TagNormalizationError } from "@mimimilli/shared";
import type { SmartFolder, SmartFolderCreate, SmartFolderRule } from "@mimimilli/shared";

function invalidTagRuleError(tag: string): string {
  return `「${tag}」は登録できないタグです`;
}

export type SmartFolderEditorConjunction = "WHERE" | "AND" | "OR" | "AND NOT";

export type SmartFolderEditorRule =
  | {
      id: string;
      conjunction: SmartFolderEditorConjunction;
      field: "タグ";
      operator: "∋";
      values: string[];
    }
  | {
      id: string;
      conjunction: Exclude<SmartFolderEditorConjunction, "AND NOT">;
      field: "長さ";
      operator: "≥";
      values: [string];
    };

export interface SmartFolderEditorDraft {
  name: string;
  rules: SmartFolderEditorRule[];
}

export interface SmartFolderEditorErrors {
  name?: string;
  ruleValues: Record<string, string>;
}

export type SmartFolderEditorResult =
  | { success: true; data: SmartFolderCreate }
  | { success: false; errors: SmartFolderEditorErrors };

export type SmartFolderEditorState =
  | { status: "closed" }
  | { status: "create" }
  | { status: "edit"; folder: SmartFolder };

export const closedSmartFolderEditorState: SmartFolderEditorState = { status: "closed" };
export const createSmartFolderEditorState: SmartFolderEditorState = { status: "create" };

export function editSmartFolderEditorState(folder: SmartFolder): SmartFolderEditorState {
  return { status: "edit", folder };
}

export function createEmptySmartFolderRule(
  id: string,
  conjunction: SmartFolderEditorConjunction = "AND",
): SmartFolderEditorRule {
  return { id, conjunction, field: "タグ", operator: "∋", values: [] };
}

export function createSmartFolderDraft(folder?: SmartFolder): SmartFolderEditorDraft {
  if (!folder) {
    return { name: "", rules: [createEmptySmartFolderRule("rule-0", "WHERE")] };
  }

  return {
    name: folder.name,
    rules: folder.rules.map((rule, index) => ({
      ...rule,
      id: `rule-${index}`,
      values: [...rule.values],
      conjunction: index === 0 ? "WHERE" : rule.conjunction,
    })) as SmartFolderEditorRule[],
  };
}

export function addSmartFolderRule(
  draft: SmartFolderEditorDraft,
  id: string,
): SmartFolderEditorDraft {
  const conjunction = draft.rules.length === 0 ? "WHERE" : "AND";
  return { ...draft, rules: [...draft.rules, createEmptySmartFolderRule(id, conjunction)] };
}

export function removeSmartFolderRule(
  draft: SmartFolderEditorDraft,
  id: string,
): SmartFolderEditorDraft {
  const rules = draft.rules
    .filter((rule) => rule.id !== id)
    .map((rule, index) => (index === 0 ? { ...rule, conjunction: "WHERE" as const } : rule));
  return { ...draft, rules };
}

export function updateSmartFolderRule(
  draft: SmartFolderEditorDraft,
  id: string,
  update: (rule: SmartFolderEditorRule) => SmartFolderEditorRule,
): SmartFolderEditorDraft {
  return {
    ...draft,
    rules: draft.rules.map((rule, index) => {
      if (rule.id !== id) return rule;
      const updated = update(rule);
      return index === 0 ? { ...updated, conjunction: "WHERE" } : updated;
    }),
  };
}

export function changeSmartFolderRuleField(
  draft: SmartFolderEditorDraft,
  id: string,
  field: SmartFolderEditorRule["field"],
): SmartFolderEditorDraft {
  return updateSmartFolderRule(draft, id, (rule) => {
    if (field === "長さ") {
      return {
        id: rule.id,
        conjunction: rule.conjunction === "AND NOT" ? "AND" : rule.conjunction,
        field,
        operator: "≥",
        values: ["0"],
      };
    }
    return { id: rule.id, conjunction: rule.conjunction, field, operator: "∋", values: [] };
  });
}

/** 条件行だけを検証し、API契約の SmartFolderRule[] へ変換する。名前の検証を含まないため、
 *  ライブ件数プレビュー（保存前に条件だけが妥当か確認したい場面）と validateSmartFolderDraft の
 *  両方から共有する */
export function validateSmartFolderDraftRules(
  rules: SmartFolderEditorRule[],
):
  | { success: true; rules: SmartFolderRule[] }
  | { success: false; ruleValues: Record<string, string> } {
  const ruleValues: Record<string, string> = {};
  const result: SmartFolderRule[] = [];

  rules.forEach((rule, index) => {
    const conjunction = index === 0 ? "WHERE" : rule.conjunction;
    if (rule.field === "タグ") {
      let values;
      try {
        values = dedupeTags(normalizeTags(rule.values));
      } catch (error) {
        if (error instanceof TagNormalizationError) {
          ruleValues[rule.id] = invalidTagRuleError(error.tag);
          return;
        }
        throw error;
      }
      if (values.length === 0) {
        ruleValues[rule.id] = "タグを1つ以上選択してください";
        return;
      }
      result.push({ conjunction, field: "タグ", operator: "∋", values });
      return;
    }

    const value = rule.values[0].trim();
    if (!/^\d+$/.test(value)) {
      ruleValues[rule.id] = "長さを0以上の整数で入力してください";
      return;
    }
    const lengthConjunction = conjunction === "AND NOT" ? "AND" : conjunction;
    result.push({ conjunction: lengthConjunction, field: "長さ", operator: "≥", values: [value] });
  });

  if (Object.keys(ruleValues).length > 0) {
    return { success: false, ruleValues };
  }
  return { success: true, rules: result };
}

export function validateSmartFolderDraft(draft: SmartFolderEditorDraft): SmartFolderEditorResult {
  const name = draft.name.trim();
  const rulesResult = validateSmartFolderDraftRules(draft.rules);

  // 条件0件は「すべての作品に一致する」正式な仕様として保存を許可する
  // （shared契約・server評価・SmartFolderView表示のいずれも rules: [] を全作品として扱う）。
  const errors: SmartFolderEditorErrors = {
    ruleValues: rulesResult.success ? {} : rulesResult.ruleValues,
  };
  if (name.length === 0) errors.name = "名前を入力してください";

  if (errors.name || Object.keys(errors.ruleValues).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { name, rules: rulesResult.success ? rulesResult.rules : [], sort: "added-desc" },
  };
}
