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
      row("f", "RJ000005", { state: "fetched", title: "t", cover: { state: "none" } }),
      row("g", null, { state: "none" }),
    ];
    expect(fetchTarget(base)).toEqual({ codes: ["RJ000001"], force: false });
    expect(
      fetchTarget([
        ...base,
        row("h", "RJ000006", { state: "fetched", title: "t", cover: { state: "missing" } }),
        row("i", "RJ000007", { state: "fetched", title: "t", cover: { state: "failed" } }),
      ]),
    ).toEqual({ codes: ["RJ000001", "RJ000006"], force: false });
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
    row("a", "RJ000001", { state: "fetched", title: "t", cover: { state: "none" } }),
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
  const fetched = row("a", "RJ000001", { state: "fetched", title: "t", cover: { state: "none" } });
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

  it("カバー未取得の行は、未取得と同じく force なしで取得になり、カバー取得失敗の行は追加に進む", () => {
    const coverMissing = row("f", "RJ000007", {
      state: "fetched",
      title: "t",
      cover: { state: "missing" },
    });
    expect(footerPlan([fetched, coverMissing])).toEqual({
      kind: "fetch",
      codes: ["RJ000007"],
      force: false,
    });
    const coverFailed = row("g", "RJ000008", {
      state: "fetched",
      title: "t",
      cover: { state: "failed" },
    });
    expect(footerPlan([fetched, coverFailed])).toEqual({ kind: "add" });
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
        new Map([["d", { selected: true, judgments: ["missing"], rjCode: null }]]),
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

describe("選択の上書き（判断の理由 × 操作 → 選択）", () => {
  const MISSING = [{ workId: "w", title: "旧", previousPath: "old/path" }];
  const fetched: CandidateDlsiteDisplay = {
    state: "fetched",
    title: "題",
    cover: { state: "none" },
  };
  const make = (
    display: CandidateDlsiteDisplay,
    resultRevision: number | null,
    options: { missing?: boolean; rjCode?: string } = {},
  ): CandidateRowModel => ({
    candidate: buildScanCandidate({
      path: "p",
      rjCode: options.rjCode ?? "RJ000001",
      missingWorks: options.missing ? MISSING : [],
    }),
    display,
    resultRevision,
  });

  /** 行を見て選択（または外し）たあと、行が順に変わっていったときの選択 */
  const cases: Array<{
    name: string;
    first: CandidateRowModel;
    selected: boolean;
    steps: Array<[label: string, row: CandidateRowModel, expected: boolean]>;
  }> = [
    {
      name: "判断不要の行を外す",
      first: make({ state: "none" }, null),
      selected: false,
      steps: [
        ["同じ行", make({ state: "none" }, null), false],
        ["取得中", make({ state: "fetching" }, null), false],
        ["取得成功", make(fetched, 12), false],
        ["RJコードを直した", make({ state: "none" }, null, { rjCode: "RJ000009" }), true],
      ],
    },
    {
      name: "判断不要の行を選ぶ（既定どおり）",
      first: make({ state: "none" }, null),
      selected: true,
      steps: [
        ["取得成功", make(fetched, 12), true],
        ["取得が失敗した", make({ state: "failed" }, 12), false],
        ["取得が該当なしだった", make({ state: "not_found" }, 12), false],
      ],
    },
    {
      name: "行方不明の作品と同じRJコードの未取得の行を選ぶ",
      first: make({ state: "none" }, null, { missing: true }),
      selected: true,
      steps: [
        ["取得中", make({ state: "fetching" }, null, { missing: true }), true],
        ["取得成功", make(fetched, 12, { missing: true }), true],
        ["取得が失敗した", make({ state: "failed" }, 12, { missing: true }), false],
      ],
    },
    {
      name: "行方不明と失敗が重なった行を選ぶ",
      first: make({ state: "failed" }, 10, { missing: true }),
      selected: true,
      steps: [
        ["同じ行", make({ state: "failed" }, 10, { missing: true }), true],
        ["取得中", make({ state: "fetching" }, 10, { missing: true }), true],
        ["取得成功", make(fetched, 12, { missing: true }), true],
        ["再び失敗した", make({ state: "failed" }, 12, { missing: true }), false],
      ],
    },
    {
      name: "失敗の行を選ぶ",
      first: make({ state: "failed" }, 10),
      selected: true,
      steps: [
        ["同じ行", make({ state: "failed" }, 10), true],
        ["取得中", make({ state: "fetching" }, 10), true],
        ["取得成功", make(fetched, 12), true],
        ["再び失敗した", make({ state: "failed" }, 12), false],
        ["再び該当なしだった", make({ state: "not_found" }, 12), false],
      ],
    },
    {
      name: "結果の無かった（DBの失敗だけの）行を選ぶ",
      first: make({ state: "failed" }, null),
      selected: true,
      steps: [
        ["同じ行", make({ state: "failed" }, null), true],
        ["取り直して再び失敗した", make({ state: "failed" }, 12), false],
      ],
    },
    {
      name: "失敗の行を外す",
      first: make({ state: "failed" }, 10),
      selected: false,
      steps: [
        ["取得中", make({ state: "fetching" }, 10), false],
        ["取得成功", make(fetched, 12), false],
        ["再び失敗した", make({ state: "failed" }, 12), false],
      ],
    },
  ];

  for (const { name, first, selected, steps } of cases) {
    it.each(steps)(`${name} → %s`, (_label, next, expected) => {
      const overrides = new Map([["p", selectionOverride(first, selected)]]);
      expect(isRowSelected(next, overrides)).toBe(expected);
    });
  }

  it("上書きが無い行は、判断の要る行は選ばず、それ以外は選ぶ", () => {
    expect(isRowSelected(make({ state: "failed" }, 10), new Map())).toBe(false);
    expect(isRowSelected(make({ state: "none" }, null), new Map())).toBe(true);
  });

  it("除外して戻した行（候補から外れていたあいだ）も、上書きが残って選択が保たれる", () => {
    const row = make({ state: "failed" }, 10);
    const overrides = new Map([["p", selectionOverride(row, true)]]);
    // 候補に無いあいだ、上書きは Map に残る。戻ったときに同じ状態の行なら選択が戻る
    expect(isRowSelected(make({ state: "failed" }, 10), overrides)).toBe(true);
  });
});
