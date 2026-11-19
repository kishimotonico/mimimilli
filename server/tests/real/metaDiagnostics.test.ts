import assert from "node:assert/strict";
import { test } from "node:test";
import { describeMetaDiagnostic } from "../../src/adapters/real/metaDiagnostics.ts";
import { inspectMetaBytes } from "../../src/adapters/real/meta.ts";

const ID = "11111111-1111-4111-8111-111111111111";

function describeText(text: string): string {
  const { diagnostic } = inspectMetaBytes(Buffer.from(text, "utf-8"));
  assert.ok(diagnostic, "診断が返る");
  return describeMetaDiagnostic("mimimilli.json", diagnostic);
}

function describeMeta(meta: unknown): string {
  return describeText(JSON.stringify(meta, null, 2));
}

test("JSON構文エラーは行番号と原因を返す", () => {
  const cases: Array<[string, string]> = [
    [`{\n  "formatVersion": 1\n  "id": "x"\n}`, "mimimilli.json 2行目: カンマが足りない"],
    [`{\n  "formatVersion": 1,\n}`, "mimimilli.json 2行目: 余分なカンマがある"],
    [`{ broken`, `mimimilli.json 1行目: 「"」で囲まれていない文字がある`],
    [`{\n  "id": "abc\n}`, `mimimilli.json 2行目: 文字列の「"」が閉じていない`],
    [`{\n  'id': 1\n}`, "mimimilli.json 2行目: 文字列は「'」ではなく「\"」で囲む"],
    [`{\n  "id" 1\n}`, "mimimilli.json 2行目: 「:」が足りない"],
    [`{\n  "id": 1`, "mimimilli.json 2行目: 「}」が足りない"],
    [`{"a": [1, 2`, "mimimilli.json 1行目: 「]」が足りない"],
    [`{"a": 1} }`, "mimimilli.json 1行目: 閉じたあとに余分な文字がある"],
    [`{\r\n  // c\r\n}`, "mimimilli.json 2行目: コメントは書けない"],
    ["", "mimimilli.json: ファイルが空"],
    ["  \n", "mimimilli.json: ファイルが空"],
    [`﻿{}`, "mimimilli.json 1行目: 先頭に BOM がある（BOM なしの UTF-8 で保存する）"],
  ];
  for (const [text, expected] of cases) assert.equal(describeText(text), expected);
});

test("検証エラーはフィールドと原因を返し、複数あれば件数を添える", () => {
  const base = { formatVersion: 1, id: ID, title: "作品" };
  assert.equal(describeMeta({ ...base, title: "" }), "mimimilli.json 4行目: title が空");
  assert.equal(
    describeMeta({ ...base, id: "not-uuid" }),
    "mimimilli.json 3行目: id がUUIDの形式でない",
  );
  assert.equal(describeMeta({ formatVersion: 1, id: ID }), "mimimilli.json: title がない");
  assert.equal(describeMeta({ ...base, tags: "x" }), "mimimilli.json 5行目: tags が配列でない");
  assert.equal(
    describeMeta({ ...base, tags: "x", title: "" }),
    "mimimilli.json 4行目: title が空（ほか1件）",
  );
  assert.equal(
    describeMeta({ ...base, dlsite: { rjCode: "RJ123456", status: "error", appliedTags: [] } }),
    `mimimilli.json 7行目: dlsite.status が使えない値（"error"）`,
  );
});

test("未対応のformatVersionは値を添える", () => {
  assert.equal(
    describeMeta({ formatVersion: 2, id: ID, title: "作品" }),
    "mimimilli.json 2行目: formatVersion 2 には未対応",
  );
});

test("作品ID重複はIDを含める", () => {
  assert.equal(
    describeMetaDiagnostic("mimimilli.json", { kind: "duplicateId", id: ID }),
    `mimimilli.json: 作品ID ${ID} が別の作品情報ファイルと重複している`,
  );
});
