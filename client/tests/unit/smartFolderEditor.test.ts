import type { SmartFolder } from "@mimimilli/shared";
import {
  addSmartFolderRule,
  changeSmartFolderRuleField,
  createSmartFolderDraft,
  removeSmartFolderRule,
  updateSmartFolderRule,
  validateSmartFolderDraft,
} from "../../src/features/library/model/smartFolderEditor";

describe("smart folder editor state", () => {
  test("新規ドラフトは空のタグ条件を1件持つ", () => {
    const draft = createSmartFolderDraft();
    expect(draft).toEqual({
      name: "",
      rules: [{ id: "rule-0", conjunction: "WHERE", field: "タグ", operator: "∋", values: [] }],
    });
  });

  test("条件の追加・削除後も先頭条件をWHEREに正規化する", () => {
    let draft = addSmartFolderRule(createSmartFolderDraft(), "rule-1");
    draft = updateSmartFolderRule(draft, "rule-1", (rule) => ({
      ...rule,
      conjunction: "OR",
    }));
    draft = removeSmartFolderRule(draft, "rule-0");
    expect(draft.rules).toHaveLength(1);
    expect(draft.rules[0]?.conjunction).toBe("WHERE");
  });

  test("AND NOTのタグ条件を長さへ変えるとANDへ正規化する", () => {
    let draft = addSmartFolderRule(createSmartFolderDraft(), "rule-1");
    draft = updateSmartFolderRule(draft, "rule-1", (rule) => ({
      ...rule,
      conjunction: "AND NOT",
    }));
    draft = changeSmartFolderRuleField(draft, "rule-1", "長さ");
    expect(draft.rules[1]).toEqual({
      id: "rule-1",
      conjunction: "AND",
      field: "長さ",
      operator: "≥",
      values: ["0"],
    });
  });

  test("編集時は保存済みのAND/OR条件をドラフトへ復元する", () => {
    const folder: SmartFolder = {
      id: "sf-1",
      name: "長時間またはASMR",
      rules: [
        { conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] },
        { conjunction: "OR", field: "タグ", operator: "∋", values: ["ASMR"] },
      ],
      sort: "added-desc",
      createdAt: "2026-07-10T00:00:00.000Z",
    };
    expect(createSmartFolderDraft(folder).rules.map(({ id: _id, ...rule }) => rule)).toEqual(
      folder.rules,
    );
  });
});

describe("smart folder editor validation", () => {
  test("名前・条件値が空ならエラーを返す", () => {
    const emptyValue = validateSmartFolderDraft(createSmartFolderDraft());
    expect(emptyValue.success).toBe(false);
    if (!emptyValue.success) {
      expect(emptyValue.errors.name).toBe("名前を入力してください");
      expect(emptyValue.errors.ruleValues["rule-0"]).toBe("タグを1つ以上選択してください");
    }
  });

  test("条件0件は「すべての作品に一致」として保存できる", () => {
    const result = validateSmartFolderDraft({ name: "テスト", rules: [] });
    expect(result).toEqual({
      success: true,
      data: { name: "テスト", rules: [], sort: "added-desc" },
    });
  });

  test("入力を整形し、条件間ORを含むAPI入力へ変換する", () => {
    let draft = createSmartFolderDraft();
    draft = {
      ...draft,
      name: "  長時間またはASMR  ",
      rules: [
        {
          id: "rule-0",
          conjunction: "WHERE",
          field: "長さ",
          operator: "≥",
          values: ["3600"],
        },
        {
          id: "rule-1",
          conjunction: "OR",
          field: "タグ",
          operator: "∋",
          values: [" ASMR ", "ASMR"],
        },
      ],
    };
    expect(validateSmartFolderDraft(draft)).toEqual({
      success: true,
      data: {
        name: "長時間またはASMR",
        rules: [
          { conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] },
          { conjunction: "OR", field: "タグ", operator: "∋", values: ["ASMR"] },
        ],
        sort: "added-desc",
      },
    });
  });
});
