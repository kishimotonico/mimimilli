import { describe, expect, it } from "vitest";
import { workspacePath } from "@mimimilli/shared";
import {
  buildNeedsAttentionRows,
  countNeedsAttention,
} from "../../src/features/scan/model/needsAttention";
import { buildScanDiagnostics, buildScanRecord } from "../helpers/builders";

const diagnostics = buildScanDiagnostics({
  identityConflicts: [
    {
      kind: "identity_conflict",
      workId: "dup",
      paths: [workspacePath("b/a"), workspacePath("b/b")],
    },
    {
      kind: "identity_conflict",
      workId: "dup2",
      paths: [workspacePath("a/a"), workspacePath("a/b")],
    },
  ],
  invalidMetaFiles: [
    { path: workspacePath("x/mimimilli.json"), message: "mimimilli.json 4行目: カンマが足りない" },
  ],
});
const record = buildScanRecord({
  unreadablePaths: [workspacePath("secret"), workspacePath("locked")],
  dataIntegrityWarning: { skippedCount: 2, skippedWorkIds: ["w2", "w1"] },
  missingWorks: [
    { workId: "m1", title: "いない作品", previousPath: workspacePath("gone") },
    { workId: "m2", title: "あの作品", previousPath: workspacePath("gone2") },
  ],
});

describe("buildNeedsAttentionRows", () => {
  it("5種類を ID重複・読み取り失敗・アクセス不可・データ不整合・行方不明の順に並べ、種類の中は名前順にする", () => {
    const rows = buildNeedsAttentionRows({ diagnostics, record });
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
    const rows = buildNeedsAttentionRows({ diagnostics: undefined, record });
    expect(rows.filter((row) => row.kind === "dataIntegrity")).toHaveLength(2);
    expect(rows.filter((row) => row.kind === "missingWork")).toHaveLength(2);
  });

  it("出どころが未取得なら、その行は無いものとして組む", () => {
    expect(buildNeedsAttentionRows({ diagnostics: undefined, record: undefined })).toEqual([]);
    const onlyRecord = buildNeedsAttentionRows({ diagnostics: undefined, record });
    expect(onlyRecord.some((row) => row.kind === "identityConflict")).toBe(false);
  });

  it("keyは一意", () => {
    const keys = buildNeedsAttentionRows({ diagnostics, record }).map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("countNeedsAttention", () => {
  it("直すものだけを数え、行方不明は数えない", () => {
    expect(countNeedsAttention(buildNeedsAttentionRows({ diagnostics, record }))).toBe(7);
    expect(
      countNeedsAttention(
        buildNeedsAttentionRows({
          diagnostics: undefined,
          record: buildScanRecord({ missingWorks: record.missingWorks }),
        }),
      ),
    ).toBe(0);
  });

  it("ID重複はパス数に関わらず競合1件で1と数える", () => {
    const rows = buildNeedsAttentionRows({
      diagnostics: buildScanDiagnostics({
        identityConflicts: [
          {
            kind: "identity_conflict",
            workId: "d",
            paths: [workspacePath("a"), workspacePath("b"), workspacePath("c")],
          },
        ],
      }),
      record: undefined,
    });
    expect(countNeedsAttention(rows)).toBe(1);
  });
});
