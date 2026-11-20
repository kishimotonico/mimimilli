import { describe, expect, it } from "vitest";
import {
  addTargets,
  fetchTarget,
  footerPlan,
  isRowSelected,
  judgmentCount,
  missingDlsiteRows,
  needsJudgment,
  pruneStaleOverrides,
  selectionOverride,
  type CandidateRowModel,
} from "../../src/features/scan/model/unregisteredSelection";
import type { CandidateDlsiteDisplay } from "../../src/features/scan/model/unregisteredDlsite";
import { buildScanCandidate } from "../helpers/builders";

function row(
  path: string,
  rjCode: string | null,
  display: CandidateDlsiteDisplay,
): CandidateRowModel {
  return { candidate: buildScanCandidate({ path, rjCode }), display };
}

describe("fetchTarget", () => {
  it("RJコードがあって未取得・該当なし・失敗のものを、コードの重複なしで返す。該当なし・失敗があれば force", () => {
    const base = [
      row("a", "RJ000001", { state: "none" }),
      row("b", "rj000001", { state: "none" }),
      row("d", "RJ000003", { state: "fetching" }),
      row("f", "RJ000005", { state: "fetched", title: "t", cover: null }),
      row("g", null, { state: "none" }),
    ];
    expect(fetchTarget(base)).toEqual({ codes: ["RJ000001"], force: false });
    expect(
      fetchTarget([
        ...base,
        row("c", "RJ000002", { state: "failed" }),
        row("e", "RJ000004", { state: "not_found" }),
      ]),
    ).toEqual({ codes: ["RJ000001", "RJ000002", "RJ000004"], force: true });
  });
});

describe("missingDlsiteRows", () => {
  const rows = [
    row("a", "RJ000001", { state: "fetched", title: "t", cover: null }),
    row("b", "RJ000002", { state: "none" }),
    row("c", "RJ000003", { state: "failed" }),
    row("d", "RJ000004", { state: "not_found" }),
    row("f", null, { state: "none" }),
  ];

  it("DLsite情報なしの行は、取得済みでないもの。RJコードのない行も含む", () => {
    expect(missingDlsiteRows(rows).map(({ candidate }) => candidate.path)).toEqual([
      "b",
      "c",
      "d",
      "f",
    ]);
  });

  it("対象がすべて取得済みなら空", () => {
    expect(missingDlsiteRows([rows[0] as CandidateRowModel])).toEqual([]);
  });
});

describe("footerPlan / addTargets", () => {
  const fetched = row("a", "RJ000001", { state: "fetched", title: "t", cover: null });
  const unfetched = row("b", "RJ000002", { state: "none" });
  const fetching = row("c", "RJ000003", { state: "fetching" });
  const noCode = row("d", null, { state: "none" });

  it("未取得があれば取得、なければ追加", () => {
    expect(footerPlan([fetched, unfetched, noCode])).toEqual({
      kind: "fetch",
      codes: ["RJ000002"],
      force: false,
    });
    expect(footerPlan([fetched, noCode])).toEqual({ kind: "add" });
  });

  it("該当なし・失敗の行が選択にあれば、取得の対象に含めて force で取り直す", () => {
    const failed = row("e", "RJ000009", { state: "failed" });
    expect(footerPlan([fetched, failed])).toEqual({
      kind: "fetch",
      codes: ["RJ000009"],
      force: true,
    });
  });

  it("取得中の行が選択にあるあいだは追加にならない。未取得が残っていれば取得のまま", () => {
    expect(footerPlan([fetched, fetching])).toEqual({ kind: "waiting" });
    expect(footerPlan([unfetched, fetching])).toEqual({
      kind: "fetch",
      codes: ["RJ000002"],
      force: false,
    });
    expect(addTargets([fetched, fetching])).toEqual([]);
    expect(addTargets([fetched, noCode])).toEqual([fetched, noCode]);
  });
});

describe("needsJudgment / isRowSelected", () => {
  const ok = row("a", "RJ000001", { state: "none" });
  const notFound = row("b", "RJ000002", { state: "not_found" });
  const failed = row("c", "RJ000003", { state: "failed" });
  const badCode: CandidateRowModel = { ...row("d", null, { state: "none" }), invalidRj: true };
  const sameRj: CandidateRowModel = {
    candidate: buildScanCandidate({
      path: "e",
      rjCode: "RJ000005",
      missingWorks: [{ workId: "w", title: "旧", previousPath: "old/path" }],
    }),
    display: { state: "none" },
  };

  it("取得結果が該当なし・失敗、形式に合わないRJコード、行方不明の作品と同じRJコードが判断の要る行", () => {
    expect([ok, notFound, failed, badCode, sameRj].map(needsJudgment)).toEqual([
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(needsJudgment(row("f", null, { state: "none" }))).toBe(false);
    expect(
      isRowSelected(badCode, new Map([["d", { selected: true, judged: true, rjCode: null }]])),
    ).toBe(false);
  });

  it("上書きが無ければ、判断の要る行は選ばず、それ以外は選ぶ", () => {
    const none = new Map();
    expect([ok, notFound, badCode, sameRj].map((entry) => isRowSelected(entry, none))).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("上書きは、判断が要るかどうかが変わると捨てて既定に戻る", () => {
    const overrides = new Map([["a", selectionOverride(ok, true)]]);
    const nowFailed = row("a", "RJ000001", { state: "failed" });
    expect(isRowSelected(ok, overrides)).toBe(true);
    expect(isRowSelected(nowFailed, overrides)).toBe(false);
    const deselectedOk = new Map([["a", selectionOverride(ok, false)]]);
    const recoded = row("a", "RJ000009", { state: "none" });
    expect(isRowSelected(recoded, deselectedOk)).toBe(true);
    expect(pruneStaleOverrides([recoded], deselectedOk).size).toBe(0);
    const picked = new Map([["b", selectionOverride(notFound, true)]]);
    expect(isRowSelected(notFound, picked)).toBe(true);
    const deselected = new Map([["a", selectionOverride(ok, false)]]);
    expect(isRowSelected(ok, deselected)).toBe(false);
  });
});

describe("judgmentCount", () => {
  it("判断が要る行だけを数える", () => {
    const rows = [
      row("a", "RJ000001", { state: "not_found" }),
      row("b", "RJ000002", { state: "failed" }),
      row("c", "RJ000003", { state: "none" }),
      row("d", "RJ000004", { state: "fetching" }),
    ];
    expect(judgmentCount(rows)).toBe(2);
  });
});

describe("pruneStaleOverrides", () => {
  it("形式エラーの値が残っている行の上書きは、判断が要る行になっても消さない", () => {
    const ok = row("a", "RJ000001", { state: "none" });
    const overrides = new Map([["a", selectionOverride(ok, false)]]);
    const invalid: CandidateRowModel = { ...ok, invalidRj: true };
    expect(pruneStaleOverrides([invalid], overrides)).toBe(overrides);
    expect(isRowSelected(invalid, overrides)).toBe(false);
    expect(isRowSelected(ok, overrides)).toBe(false);
  });

  const failed = row("a", "RJ000001", { state: "failed" });
  const fetching = row("a", "RJ000001", { state: "fetching" });

  it("判断が要るかどうかが変わった行の上書きを消し、失敗→取得中→失敗で選択が戻らない", () => {
    const picked = new Map([["a", selectionOverride(failed, true)]]);
    expect(pruneStaleOverrides([failed], picked)).toBe(picked);
    const pruned = pruneStaleOverrides([fetching], picked);
    expect(pruned.size).toBe(0);
    expect(isRowSelected(failed, pruned)).toBe(false);
  });
});
