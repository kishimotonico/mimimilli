import { describe, expect, it } from "vitest";
import {
  addTargets,
  fetchTarget,
  footerPlan,
  isRowSelected,
  judgmentCount,
  missingDlsiteRows,
  needsJudgment,
  selectionOverride,
  type CandidateRowModel,
} from "../../src/features/scan/model/unregisteredSelection";
import type { CandidateDlsiteDisplay } from "../../src/features/scan/model/unregisteredDlsite";
import { buildScanCandidate } from "../helpers/builders";

function row(
  path: string,
  rjCode: string | null,
  display: CandidateDlsiteDisplay,
  resultRevision: number | null = null,
): CandidateRowModel {
  return { candidate: buildScanCandidate({ path, rjCode }), display, resultRevision };
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
    resultRevision: null,
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
      isRowSelected(
        badCode,
        new Map([["d", { selected: true, judged: true, rjCode: null, resultRevision: null }]]),
      ),
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

describe("取得結果の revision と選択の上書き", () => {
  const failed = row("a", "RJ000001", { state: "failed" }, 10);
  const picked = new Map([["a", selectionOverride(failed, true)]]);

  it("失敗の行を選んだあと、取得中を観測しなくても、取り直して再び失敗すれば（revision が進めば）選択は戻る", () => {
    expect(isRowSelected(failed, picked)).toBe(true);
    const failedAgain = row("a", "RJ000001", { state: "failed" }, 11);
    expect(isRowSelected(failedAgain, picked)).toBe(false);
  });

  it("結果が変わらなければ、取得中を挟んでも選択は残る", () => {
    const fetching = row("a", "RJ000001", { state: "fetching" }, 10);
    expect(isRowSelected(fetching, picked)).toBe(true);
    expect(isRowSelected(failed, picked)).toBe(true);
  });

  it("取得中に外した行は、取得が成功しても外れたまま", () => {
    const unfetched = row("b", "RJ000002", { state: "none" }, null);
    const deselected = new Map([["b", selectionOverride(unfetched, false)]]);
    const fetching = row("b", "RJ000002", { state: "fetching" }, null);
    const fetched = row("b", "RJ000002", { state: "fetched", title: "題", cover: null }, 12);
    expect(isRowSelected(fetching, deselected)).toBe(false);
    expect(isRowSelected(fetched, deselected)).toBe(false);
  });

  it("失敗の行を選び、取り直して再び失敗すると（結果の revision が進むと）選択が外れる", () => {
    const failedAgain = row("a", "RJ000001", { state: "failed" }, 11);
    expect(isRowSelected(failedAgain, picked)).toBe(false);
    const retryFetching = row("a", "RJ000001", { state: "fetching" }, 10);
    expect(isRowSelected(retryFetching, picked)).toBe(true);
  });
});
