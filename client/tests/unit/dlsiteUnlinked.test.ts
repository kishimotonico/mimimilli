import { describe, expect, it } from "vitest";
import type { DlsiteState, WorkSummary } from "@mimimilli/shared";
import { filterDlsiteUnlinkedWorks } from "../../src/features/library/model/dlsiteUnlinked";

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

describe("filterDlsiteUnlinkedWorks", () => {
  it("RJコードがあり status が none の作品だけを抽出する", () => {
    const works = [
      work("unlinked", { rjCode: "RJ111111", status: "none" }),
      work("rjMissing", { rjCode: null, status: "none" }),
      work("error", { rjCode: "RJ222222", status: "error" }),
      work("applied", { rjCode: "RJ333333", status: "applied" }),
      work("skipped", { rjCode: "RJ444444", status: "skipped" }),
    ];

    expect(filterDlsiteUnlinkedWorks(works).map((w) => w.id)).toEqual(["unlinked"]);
  });
});
