import { describe, expect, it } from "vitest";
import type { ScanCandidate } from "@mimimilli/shared";
import type {
  DlsiteJobCodeView,
  DlsiteJobState,
} from "../../src/entities/dlsite/model/dlsiteJobStore";
import { candidateDlsiteDisplay } from "../../src/features/scan/model/unregisteredDlsite";
import {
  dlsiteBulkFrame,
  formatDlsiteFetchEstimate,
} from "../../src/entities/dlsite/model/dlsiteBulkFrame";

const cover = { key: "k", version: "v" } as never;

function candidate(rjCode: string | null, dlsite: ScanCandidate["dlsite"]): ScanCandidate {
  return {
    path: "a/b",
    inferredTitle: "t",
    audioFileCount: 1,
    audioBreakdown: [{ extension: "wav", count: 1 }],
    rjCode,
    dlsite,
    missingWorks: [],
  } as ScanCandidate;
}

function jobState(
  codes: Record<string, DlsiteJobCodeView>,
  overrides: Partial<DlsiteJobState> & {
    status?: "running" | "finished";
    bulk?: { processed: number; total: number };
  } = {},
): DlsiteJobState {
  const { status = "running", bulk = { processed: 0, total: 0 }, ...rest } = overrides;
  return {
    job: { jobId: "j", status, codes: new Map(Object.entries(codes)), bulk },
    startingBulk: null,
    pendingSingles: new Set(),
    cancelling: false,
    settled: false,
    error: null,
    ...rest,
  };
}

const noJob = jobState({}, {});
const empty: DlsiteJobState = { ...noJob, job: null, settled: true };

describe("candidateDlsiteDisplay", () => {
  it("1. rjCode が無ければ none", () => {
    expect(candidateDlsiteDisplay(candidate(null, { state: "none" }), empty)).toEqual({
      state: "none",
    });
  });

  it("2. 単発の保留が最優先で fetching", () => {
    const state = jobState(
      { RJ000001: { origin: "bulk", state: "fetched" } },
      { pendingSingles: new Set(["RJ000001"]) },
    );
    expect(candidateDlsiteDisplay(candidate("RJ000001", { state: "failed" }), state)).toEqual({
      state: "fetching",
    });
  });

  it("3. 実行中ジョブの queued/fetching は fetching（表記ゆれも重なる）", () => {
    for (const code of ["queued", "fetching"] as const) {
      const state = jobState({ RJ000001: { origin: "bulk", state: code } });
      expect(candidateDlsiteDisplay(candidate("rj000001", { state: "none" }), state)).toEqual({
        state: "fetching",
      });
    }
  });

  it("4. 終端状態は settled の前だけ重ね、後は候補一覧に従う", () => {
    const failed = jobState({ RJ000001: { origin: "single", state: "failed" } });
    expect(candidateDlsiteDisplay(candidate("RJ000001", { state: "none" }), failed)).toEqual({
      state: "failed",
    });
    expect(
      candidateDlsiteDisplay(candidate("RJ000001", { state: "none" }), {
        ...failed,
        settled: true,
      }),
    ).toEqual({ state: "none" });
    const notFound = jobState(
      { RJ000001: { origin: "bulk", state: "not_found" } },
      { status: "finished" },
    );
    expect(candidateDlsiteDisplay(candidate("RJ000001", { state: "none" }), notFound)).toEqual({
      state: "not_found",
    });
  });

  it("4. fetched は候補一覧が追いつくまで title・cover が null", () => {
    const state = jobState({ RJ000001: { origin: "bulk", state: "fetched" } });
    expect(candidateDlsiteDisplay(candidate("RJ000001", { state: "none" }), state)).toEqual({
      state: "fetched",
      title: null,
      cover: null,
    });
    expect(
      candidateDlsiteDisplay(
        candidate("RJ000001", { state: "fetched", title: "題", cover }),
        state,
      ),
    ).toEqual({ state: "fetched", title: "題", cover });
  });

  it("5. ジョブにないコードは候補一覧をそのまま出す", () => {
    expect(
      candidateDlsiteDisplay(candidate("RJ000009", { state: "not_found" }), jobState({})),
    ).toEqual({ state: "not_found" });
    expect(candidateDlsiteDisplay(candidate("RJ000009", { state: "fetching" }), empty)).toEqual({
      state: "fetching",
    });
    expect(
      candidateDlsiteDisplay(
        candidate("RJ000009", { state: "fetched", title: "題", cover: null }),
        empty,
      ),
    ).toEqual({ state: "fetched", title: "題", cover: null });
  });

  it("終端後に同じコードの単発が再キューされると fetching に戻る", () => {
    const state = jobState({ RJ000001: { origin: "single", state: "queued" } });
    expect(candidateDlsiteDisplay(candidate("RJ000001", { state: "failed" }), state)).toEqual({
      state: "fetching",
    });
  });
});

describe("dlsiteBulkFrame", () => {
  it("ジョブなし・全件終端・単発だけなら idle", () => {
    expect(dlsiteBulkFrame(empty)).toEqual({ kind: "idle" });
    expect(
      dlsiteBulkFrame(
        jobState(
          { RJ000001: { origin: "bulk", state: "fetched" } },
          { bulk: { processed: 1, total: 1 } },
        ),
      ),
    ).toEqual({ kind: "idle" });
    expect(
      dlsiteBulkFrame(jobState({ RJ000001: { origin: "single", state: "fetching" } })),
    ).toEqual({ kind: "idle" });
  });

  it("まとめて進行中は n/N と残り時間と中止可否を出し、単発が来ても変わらない", () => {
    const bulk = { processed: 2, total: 5 };
    const base = jobState({ RJ000001: { origin: "bulk", state: "queued" } }, { bulk });
    const frame = dlsiteBulkFrame(base);
    expect(frame).toEqual({
      kind: "progress",
      processed: 2,
      total: 5,
      remainingMs: 6000,
      cancellable: true,
    });
    const withSingle = jobState(
      {
        RJ000001: { origin: "bulk", state: "queued" },
        RJ000002: { origin: "single", state: "fetching" },
      },
      { bulk },
    );
    expect(dlsiteBulkFrame(withSingle)).toEqual(frame);
  });

  it("中止中、または待機中のまとめてが無ければ cancellable は false", () => {
    const bulk = { processed: 0, total: 2 };
    expect(
      dlsiteBulkFrame(
        jobState({ RJ000001: { origin: "bulk", state: "queued" } }, { bulk, cancelling: true }),
      ),
    ).toMatchObject({ kind: "progress", cancellable: false });
    expect(
      dlsiteBulkFrame(jobState({ RJ000001: { origin: "bulk", state: "fetching" } }, { bulk })),
    ).toMatchObject({ kind: "progress", cancellable: false });
  });

  it("開始の応答待ちは processed 0・total=件数で中止不可の progress", () => {
    expect(dlsiteBulkFrame({ ...empty, startingBulk: { total: 30 } })).toEqual({
      kind: "progress",
      processed: 0,
      total: 30,
      remainingMs: 60_000,
      cancellable: false,
    });
  });
});

describe("formatDlsiteFetchEstimate", () => {
  it.each([
    [2000, "約2秒"],
    [59_000, "約59秒"],
    [60_000, "約1分"],
    [150_000, "約3分"],
  ])("%dms は %s", (ms, text) => {
    expect(formatDlsiteFetchEstimate(ms)).toBe(text);
  });
});
