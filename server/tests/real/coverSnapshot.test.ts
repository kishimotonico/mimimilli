import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { spyOn } from "bun:test";
import { THUMBNAIL_WIDTHS } from "@mimimilli/shared";
import type { WorkSummary } from "@mimimilli/shared";
import sharp from "sharp";
import {
  buildCoverSnapshot,
  isCoverSnapshotComplete,
} from "../../src/adapters/real/coverSnapshot.ts";
import { thumbnailCacheNames } from "../../src/adapters/real/thumbnailCache.ts";
import type { ListSummariesResult } from "../../src/adapters/real/workRowMapping.ts";

function makeSummary(
  overrides: Partial<WorkSummary> & Pick<WorkSummary, "id" | "physicalPath">,
): WorkSummary {
  return {
    title: overrides.title ?? `作品 ${overrides.id}`,
    cover: overrides.cover ?? null,
    status: overrides.status ?? "ok",
    totalDurationSec: overrides.totalDurationSec ?? 60,
    addedAt: overrides.addedAt ?? "2026-07-19T00:00:00.000Z",
    errorMessage: overrides.errorMessage ?? null,
    urls: overrides.urls ?? [],
    tags: overrides.tags ?? [],
    trackCount: overrides.trackCount ?? 1,
    bookmarked: overrides.bookmarked ?? false,
    lastPlayedAt: overrides.lastPlayedAt ?? null,
    dlsite: overrides.dlsite ?? {
      rjCode: null,
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [],
    },
    ...overrides,
  };
}

function emptyResult(overrides: Partial<ListSummariesResult> = {}): ListSummariesResult {
  return {
    summaries: [],
    skipped: [],
    unmeasuredCovers: [],
    ...overrides,
  };
}

test("isCoverSnapshotComplete: 作品0件は不完全", () => {
  assert.equal(isCoverSnapshotComplete({ workCount: 0, validNames: new Set(), gaps: [] }), false);
});

test("isCoverSnapshotComplete: gap があると不完全", () => {
  assert.equal(
    isCoverSnapshotComplete({
      workCount: 1,
      validNames: new Set(),
      gaps: [{ workId: "w-1", reason: "work-load-failed" }],
    }),
    false,
  );
});

test("isCoverSnapshotComplete: 作品あり・gap なしは完全", () => {
  assert.equal(isCoverSnapshotComplete({ workCount: 1, validNames: new Set(), gaps: [] }), true);
});

test("buildCoverSnapshot: skipped を work-load-failed として記録する", async () => {
  const snapshot = await buildCoverSnapshot(
    emptyResult({
      summaries: [makeSummary({ id: "work-ok", physicalPath: "/lib/ok" })],
      skipped: [{ workId: "work-bad", reason: "invalid" }],
    }),
  );
  assert.deepEqual(snapshot.gaps, [{ workId: "work-bad", reason: "work-load-failed" }]);
  assert.equal(snapshot.workCount, 1);
});

test("buildCoverSnapshot: unmeasuredCovers を cover-unmeasured として記録する", async () => {
  const snapshot = await buildCoverSnapshot(
    emptyResult({
      summaries: [makeSummary({ id: "work-ok", physicalPath: "/lib/ok" })],
      unmeasuredCovers: ["work-unmeasured"],
    }),
  );
  assert.deepEqual(snapshot.gaps, [{ workId: "work-unmeasured", reason: "cover-unmeasured" }]);
});

test("buildCoverSnapshot: resolveWithin 失敗を cover-path-unresolved として記録する", async () => {
  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-cover-snapshot-"));
  try {
    const snapshot = await buildCoverSnapshot(
      emptyResult({
        summaries: [
          makeSummary({
            id: "work-missing",
            physicalPath: workDir,
            cover: {
              image: "missing.jpg",
              dimensions: { width: 100, height: 100 },
              version: "missing",
            },
          }),
        ],
      }),
    );
    assert.deepEqual(snapshot.gaps, [{ workId: "work-missing", reason: "cover-path-unresolved" }]);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("buildCoverSnapshot: カバーの stat 失敗を cover-stat-failed として記録する", async (t) => {
  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-cover-snapshot-"));
  t.after(() => rmSync(workDir, { recursive: true, force: true }));
  const coverPath = join(workDir, "cover.jpg");
  writeFileSync(coverPath, "cover");

  const spy = spyOn(fs, "stat").mockImplementation((async (path) => {
    if (String(path) === coverPath) {
      throw new Error("stat failed");
    }
    return stat(path);
  }) as typeof fs.stat);
  t.after(() => spy.mockRestore());

  const snapshot = await buildCoverSnapshot(
    emptyResult({
      summaries: [
        makeSummary({
          id: "work-stat-fail",
          physicalPath: workDir,
          cover: { image: "cover.jpg", dimensions: { width: 100, height: 100 }, version: "cover" },
        }),
      ],
    }),
  );
  assert.deepEqual(snapshot.gaps, [{ workId: "work-stat-fail", reason: "cover-stat-failed" }]);
});

test("buildCoverSnapshot: stat 成功時に validNames が期待どおりになる", async (t) => {
  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-cover-snapshot-"));
  t.after(() => rmSync(workDir, { recursive: true, force: true }));
  const coverPath = join(workDir, "cover.jpg");
  await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .jpeg()
    .toFile(coverPath);

  const snapshot = await buildCoverSnapshot(
    emptyResult({
      summaries: [
        makeSummary({
          id: "work-a",
          physicalPath: workDir,
          cover: { image: "cover.jpg", dimensions: { width: 100, height: 100 }, version: "cover" },
        }),
      ],
    }),
  );

  assert.equal(snapshot.gaps.length, 0);
  const { size, mtimeMs } = await stat(coverPath);
  const expected = new Set(thumbnailCacheNames("work-a", { size, mtimeMs }));
  assert.deepEqual(snapshot.validNames, expected);
  assert.equal(snapshot.validNames.size, THUMBNAIL_WIDTHS.length);
});

test("buildCoverSnapshot: カバーなし作品は gap を立てず validNames も増やさない", async () => {
  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-cover-snapshot-"));
  try {
    const snapshot = await buildCoverSnapshot(
      emptyResult({
        summaries: [makeSummary({ id: "work-no-cover", physicalPath: workDir, cover: null })],
      }),
    );
    assert.equal(snapshot.gaps.length, 0);
    assert.equal(snapshot.validNames.size, 0);
    assert.equal(snapshot.workCount, 1);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
