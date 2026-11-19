import { describe, expect, it } from "vitest";
import {
  fetchTargetCodes,
  missingDlsiteCount,
  problemCount,
  registerTargets,
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

describe("fetchTargetCodes", () => {
  it("RJコードがあって未取得のものだけを、コードの重複なしで返す", () => {
    const rows = [
      row("a", "RJ000001", { state: "none" }),
      row("b", "rj000001", { state: "none" }),
      row("c", "RJ000002", { state: "failed" }),
      row("d", "RJ000003", { state: "fetching" }),
      row("e", "RJ000004", { state: "not_found" }),
      row("f", "RJ000005", { state: "fetched", title: "t", cover: null }),
      row("g", null, { state: "none" }),
    ];
    expect(fetchTargetCodes(rows)).toEqual(["RJ000001"]);
  });
});

describe("registerTargets / missingDlsiteCount", () => {
  const rows = [
    row("a", "RJ000001", { state: "fetched", title: "t", cover: null }),
    row("b", "RJ000002", { state: "none" }),
    row("c", "RJ000003", { state: "failed" }),
    row("d", "RJ000004", { state: "not_found" }),
    row("e", "RJ000005", { state: "fetching" }),
    row("f", null, { state: "none" }),
  ];

  it("取得中の候補は追加の対象から外れる", () => {
    expect(registerTargets(rows).map((entry) => entry.candidate.path)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "f",
    ]);
  });

  it("DLsite情報なしの件数は、RJコードがあって取得済みでないものだけを数える", () => {
    expect(missingDlsiteCount(registerTargets(rows))).toBe(3);
  });

  it("対象がすべて取得済みかRJコードなしなら0", () => {
    expect(missingDlsiteCount([rows[0] as CandidateRowModel, rows[5] as CandidateRowModel])).toBe(
      0,
    );
  });
});

describe("problemCount", () => {
  it("該当なしと失敗だけを数える", () => {
    const rows = [
      row("a", "RJ000001", { state: "not_found" }),
      row("b", "RJ000002", { state: "failed" }),
      row("c", "RJ000003", { state: "none" }),
      row("d", "RJ000004", { state: "fetching" }),
    ];
    expect(problemCount(rows)).toBe(2);
  });
});
