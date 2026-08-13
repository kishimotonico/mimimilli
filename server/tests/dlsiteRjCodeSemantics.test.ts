import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyDlsiteState,
  coverFieldsFromCover,
  hasRjCode,
  isDlsiteUnlinked,
  isRjCodeMissing,
  type DlsiteState,
  type Work,
  type WorkSummary,
} from "@mimimilli/shared";
import { summarizeDlsiteNotifications } from "../src/core/dlsiteNotifications.ts";
import { selectDlsiteBulkTargets } from "../src/adapters/real/dlsiteBulk.ts";
import { openDb } from "../src/adapters/real/db.ts";
import { createWorkRepos, upsertTestWork } from "./helpers/workTestUtils.ts";
import { nts } from "./helpers/tag.ts";

function dlsiteState(
  rjCode: DlsiteState["rjCode"],
  status: DlsiteState["status"] = "none",
): DlsiteState {
  return { ...emptyDlsiteState(), rjCode, status };
}

function workSummary(id: string, dlsite: DlsiteState): WorkSummary {
  return {
    id,
    title: id,
    cover: null,
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 0,
    addedAt: "2026-08-14T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: nts([]),
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite,
  };
}

test("hasRjCode: null と空文字はRJコードなし、非空文字列のみtrue", () => {
  assert.equal(hasRjCode(dlsiteState(null)), false);
  assert.equal(hasRjCode(dlsiteState("")), false);
  assert.equal(hasRjCode(dlsiteState("RJ123456")), true);
});

test("isRjCodeMissing: null のみ未検出。空文字はユーザー明示のRJコードなし", () => {
  assert.equal(isRjCodeMissing(dlsiteState(null)), true);
  assert.equal(isRjCodeMissing(dlsiteState("")), false);
  assert.equal(isRjCodeMissing(dlsiteState("RJ123456")), false);
  assert.equal(isRjCodeMissing(dlsiteState(null, "skipped")), false);
});

test("isDlsiteUnlinked: 非空RJコードかつstatus none のみ未連携", () => {
  assert.equal(isDlsiteUnlinked(dlsiteState(null)), false);
  assert.equal(isDlsiteUnlinked(dlsiteState("")), false);
  assert.equal(isDlsiteUnlinked(dlsiteState("RJ123456")), true);
  assert.equal(isDlsiteUnlinked(dlsiteState("RJ123456", "applied")), false);
});

function asWork(summary: WorkSummary): Work {
  const { trackCount: _trackCount, ...work } = summary;
  const { coverKind, coverImage } = coverFieldsFromCover(summary.cover);
  return {
    ...work,
    coverKind,
    coverImage,
    defaultPlaylistId: null,
    createdAt: null,
    playlists: [],
    resume: null,
  };
}

test("rjCode 4状態: JS集計・SQL集計・一括取得対象が一致する", () => {
  const states = {
    missing: dlsiteState(null),
    explicitEmpty: dlsiteState(""),
    unlinked: dlsiteState("RJ123456"),
    skippedMissing: dlsiteState(null, "skipped"),
  };
  const summaries = [
    workSummary("missing", states.missing),
    workSummary("explicit-empty", states.explicitEmpty),
    workSummary("unlinked", states.unlinked),
    workSummary("skipped-missing", states.skippedMissing),
  ];

  assert.deepEqual(summarizeDlsiteNotifications(Object.values(states)), {
    rjCodeMissingCount: 1,
    fetchFailedCount: 0,
    parseErrorCount: 0,
    parseErrorAlert: false,
    unlinkedCount: 1,
  });

  const db = openDb({ kind: "memory" });
  const { query, catalog, user } = createWorkRepos(db);
  try {
    for (const summary of summaries) {
      upsertTestWork(catalog, user, asWork(summary));
    }
    assert.deepEqual(query.getDlsiteNotificationSummary(), {
      rjCodeMissingCount: 1,
      fetchFailedCount: 0,
      parseErrorCount: 0,
      parseErrorAlert: false,
      unlinkedCount: 1,
    });

    const bulk = selectDlsiteBulkTargets(query, undefined, { warn: () => {} });
    assert.deepEqual(
      bulk.targets.map((work) => work.id),
      ["unlinked"],
    );
    assert.equal(bulk.skipped, 3);
  } finally {
    db.close();
  }
});
