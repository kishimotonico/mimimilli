import { describe, expect, it } from "vitest";
import { workspacePath } from "@mimimilli/shared";
import { buildNeedsAttentionRows } from "../../src/features/scan/model/needsAttention";
import { buildScanDiagnostics } from "../helpers/builders";

const diagnostics = buildScanDiagnostics({
  identityConflicts: [
    {
      kind: "identity_conflict",
      registeredTitle: "登録済みの作品",
      workId: "dup",
      paths: [workspacePath("b/a"), workspacePath("b/b")],
    },
    {
      kind: "identity_conflict",
      registeredTitle: null,
      workId: "dup2",
      paths: [workspacePath("a/a"), workspacePath("a/b")],
    },
  ],
  invalidMetaFiles: [
    { path: workspacePath("x/mimimilli.json"), message: "mimimilli.json 4行目: カンマが足りない" },
  ],
  unreadablePaths: [workspacePath("secret"), workspacePath("locked")],
  dataIntegrityWorkIds: ["w2", "w1"],
  missingWorks: [
    { workId: "m1", title: "いない作品", previousPath: workspacePath("gone") },
    { workId: "m2", title: "あの作品", previousPath: workspacePath("gone2") },
  ],
});

describe("buildNeedsAttentionRows", () => {
  it("5種類を ID重複・読み取り失敗・アクセス不可・データ不整合・行方不明の順に並べ、種類の中は名前順にする", () => {
    const rows = buildNeedsAttentionRows(diagnostics);
    expect(rows.map((row) => row.key)).toEqual([
      "identity:dup2",
      "identity:dup",
      "invalid:x/mimimilli.json",
      "unreadable:locked",
      "unreadable:secret",
      "integrity:w1",
      "integrity:w2",
      "missing:m2",
      "missing:m1",
    ]);
  });

  it("データ不整合と行方不明は1作品1行で組む", () => {
    const rows = buildNeedsAttentionRows(diagnostics);
    expect(rows.filter((row) => row.kind === "dataIntegrity")).toHaveLength(2);
    expect(rows.filter((row) => row.kind === "missingWork")).toHaveLength(2);
  });

  it("診断が未取得なら、行は無いものとして組む", () => {
    expect(buildNeedsAttentionRows(undefined)).toEqual([]);
  });

  it("keyは一意", () => {
    const keys = buildNeedsAttentionRows(diagnostics).map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
