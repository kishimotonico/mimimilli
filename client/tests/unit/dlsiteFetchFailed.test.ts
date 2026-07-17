import { describe, expect, it } from "vitest";
import type { DlsiteState, WorkSummary } from "@mimimilli/shared";
import { filterDlsiteFetchFailedWorks } from "../../src/features/library/model/dlsiteFetchFailed";

function work(id: string, dlsite: Partial<DlsiteState>): WorkSummary {
  return {
    id,
    title: id,
    coverImage: null,
    status: "ok",
    physicalPath: `/audio/${id}`,
    totalDurationSec: 0,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: {
      rjCode: null,
      status: "none",
      lastAttemptAt: null,
      error: null,
      appliedTags: [],
      ...dlsite,
    },
  };
}

describe("filterDlsiteFetchFailedWorks", () => {
  it("status が error または not_found の作品だけを抽出する", () => {
    const works = [
      work("error", { rjCode: "RJ111111", status: "error" }),
      work("notFound", { rjCode: "RJ222222", status: "not_found" }),
      work("none", { rjCode: "RJ333333", status: "none" }),
      work("applied", { rjCode: "RJ444444", status: "applied" }),
      work("skipped", { status: "skipped" }),
    ];

    expect(filterDlsiteFetchFailedWorks(works).map((w) => w.id)).toEqual(["error", "notFound"]);
  });

  it("該当作品がなければ空配列を返す", () => {
    const works = [work("none", { rjCode: "RJ333333", status: "none" })];
    expect(filterDlsiteFetchFailedWorks(works)).toEqual([]);
  });
});
