import { describe, expect, it } from "vitest";
import type { DlsiteJobCodeState, ScanCandidate } from "@mimimilli/shared";
import type {
  DlsiteJobCodeView,
  DlsiteJobState,
} from "../../src/entities/dlsite/model/dlsiteJobStore";
import {
  candidateDlsiteDisplay,
  dlsiteResultRevision,
} from "../../src/features/scan/model/unregisteredDlsite";
import { dlsiteFetchFrame } from "../../src/entities/dlsite/model/dlsiteFetchFrame";

const cover = { key: "k", version: "v" } as never;

function candidate(
  rjCode: string | null,
  dlsite: ScanCandidate["dlsite"],
  dlsiteRevision = 0,
): ScanCandidate {
  return {
    path: "a/b",
    inferredTitle: "t",
    audioFileCount: 1,
    audioBreakdown: [{ extension: "wav", count: 1 }],
    rjCode,
    dlsite,
    dlsiteRevision,
    missingWorks: [],
  } as ScanCandidate;
}

type CodeInput = { state: DlsiteJobCodeState; revision?: number };

function view(input: CodeInput): DlsiteJobCodeView {
  const base = { revision: input.revision ?? 1 };
  switch (input.state) {
    case "queued":
    case "fetching":
      return { ...base, state: input.state };
    case "fetched":
      return {
        ...base,
        state: "fetched",
        dlsite: { state: "fetched", title: "題", cover: { state: "none" } },
      };
    case "not_found":
    case "failed":
      return { ...base, state: input.state, dlsite: { state: input.state } };
  }
}

function jobState(
  codes: Record<string, CodeInput>,
  overrides: Partial<DlsiteJobState> & {
    status?: "running" | "finished";
    progress?: { processed: number; total: number };
  } = {},
): DlsiteJobState {
  const { status = "running", progress = { processed: 0, total: 0 }, ...rest } = overrides;
  return {
    revision: 1,
    job: {
      jobId: "j",
      status,
      codes: new Map(Object.entries(codes).map(([code, input]) => [code, view(input)])),
      progress,
    },
    results: new Map(),
    starting: null,
    cancelling: false,
    error: null,
    ...rest,
  };
}

const noJob = jobState({}, {});
const empty: DlsiteJobState = { ...noJob, job: null };

describe("candidateDlsiteDisplay", () => {
  it("1. rjCode が無ければ none", () => {
    expect(candidateDlsiteDisplay(candidate(null, { state: "none" }), empty)).toEqual({
      state: "none",
    });
  });

  it("3. 実行中ジョブの queued/fetching は fetching（表記ゆれも重なる）", () => {
    for (const code of ["queued", "fetching"] as const) {
      const state = jobState({ RJ000001: { state: code } });
      expect(candidateDlsiteDisplay(candidate("rj000001", { state: "none" }), state)).toEqual({
        state: "fetching",
      });
    }
  });

  it("3. 終わったジョブに待機中のまま残ったコードは fetching にしない", () => {
    const state = jobState({ RJ000001: { state: "queued" } }, { status: "finished" });
    expect(candidateDlsiteDisplay(candidate("RJ000001", { state: "none" }), state)).toEqual({
      state: "none",
    });
  });

  it("4. 結果の revision が候補より大きければ結果、等しい・小さければ候補を出す", () => {
    const results = new Map([["RJ000001", { dlsite: { state: "failed" as const }, revision: 30 }]]);
    const state = { ...empty, results };
    expect(candidateDlsiteDisplay(candidate("RJ000001", { state: "none" }, 5), state)).toEqual({
      state: "failed",
    });
    const newer = { state: "fetched" as const, title: "新しい", cover };
    expect(candidateDlsiteDisplay(candidate("RJ000001", newer, 40), state)).toEqual({
      state: "fetched",
      title: "新しい",
      cover,
    });
    expect(candidateDlsiteDisplay(candidate("RJ000001", newer, 30), state)).toEqual({
      state: "fetched",
      title: "新しい",
      cover,
    });
  });

  it("4. fetched の結果はタイトルとカバーを運ぶ", () => {
    const results = new Map([
      ["RJ000001", { dlsite: { state: "fetched" as const, title: "題", cover }, revision: 9 }],
    ]);
    expect(
      candidateDlsiteDisplay(candidate("RJ000001", { state: "none" }, 1), { ...empty, results }),
    ).toEqual({ state: "fetched", title: "題", cover });
  });

  it("5. 結果が無いコードは候補をそのまま出す", () => {
    expect(
      candidateDlsiteDisplay(candidate("RJ000009", { state: "not_found" }), jobState({})),
    ).toEqual({ state: "not_found" });
    expect(candidateDlsiteDisplay(candidate("RJ000009", { state: "none" }), empty)).toEqual({
      state: "none",
    });
    expect(
      candidateDlsiteDisplay(
        candidate("RJ000009", { state: "fetched", title: "題", cover: { state: "none" } }),
        empty,
      ),
    ).toEqual({ state: "fetched", title: "題", cover: { state: "none" } });
  });

  it("終端後に同じコードが再キューされると fetching に戻る", () => {
    const state = jobState({ RJ000001: { state: "queued" } });
    expect(candidateDlsiteDisplay(candidate("RJ000001", { state: "failed" }), state)).toEqual({
      state: "fetching",
    });
  });
});

describe("dlsiteResultRevision", () => {
  const withResult = (revision: number) => ({
    ...empty,
    results: new Map([["RJ000001", { dlsite: { state: "failed" as const }, revision }]]),
  });

  it("そのコードの結果の revision を返し、候補の dlsiteRevision が進んでも変わらない", () => {
    const state = withResult(12);
    expect(dlsiteResultRevision(candidate("RJ000001", { state: "failed" }, 15), state)).toBe(12);
    expect(dlsiteResultRevision(candidate("RJ000001", { state: "failed" }, 99), state)).toBe(12);
  });

  it("ジョブで取得していないコードとRJコードのない行は null", () => {
    expect(dlsiteResultRevision(candidate("RJ000001", { state: "failed" }, 15), empty)).toBeNull();
    expect(dlsiteResultRevision(candidate(null, { state: "none" }, 15), withResult(12))).toBeNull();
  });
});

describe("dlsiteFetchFrame", () => {
  it("ジョブなし・全件終端なら idle", () => {
    expect(dlsiteFetchFrame(empty)).toEqual({ kind: "idle" });
    expect(
      dlsiteFetchFrame(
        jobState({ RJ000001: { state: "fetched" } }, { progress: { processed: 1, total: 1 } }),
      ),
    ).toEqual({ kind: "idle" });
  });

  it("進行中は n/N と中止可否を出す", () => {
    const progress = { processed: 2, total: 5 };
    const base = jobState({ RJ000001: { state: "queued" } }, { progress });
    const frame = dlsiteFetchFrame(base);
    expect(frame).toEqual({
      kind: "progress",
      processed: 2,
      total: 5,
      cancellable: true,
    });
  });

  it("中止中、または待機中のコードが無ければ cancellable は false", () => {
    const progress = { processed: 0, total: 2 };
    expect(
      dlsiteFetchFrame(jobState({ RJ000001: { state: "queued" } }, { progress, cancelling: true })),
    ).toMatchObject({ kind: "progress", cancellable: false });
    expect(
      dlsiteFetchFrame(jobState({ RJ000001: { state: "fetching" } }, { progress })),
    ).toMatchObject({
      kind: "progress",
      cancellable: false,
    });
  });

  it("開始の応答待ちは processed 0・total=件数で中止不可の progress", () => {
    expect(dlsiteFetchFrame({ ...empty, starting: { total: 30 } })).toEqual({
      kind: "progress",
      processed: 0,
      total: 30,
      cancellable: false,
    });
  });
});
