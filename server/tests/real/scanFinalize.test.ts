import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { spyOn } from "bun:test";
import { THUMBNAIL_WIDTHS } from "@mimimilli/shared";
import type { WorkSummary } from "@mimimilli/shared";
import sharp from "sharp";
import { finalizeScan, LAST_SCAN_TIME_KEY } from "../../src/adapters/real/scanFinalize.ts";
import { captureLogs, recordMessage, scanRecords } from "../helpers/logCapture.ts";

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

function setupCacheDir(t: { after: (fn: () => void) => void }): string {
  const thumbnailCacheDir = mkdtempSync(join(tmpdir(), "mimimilli-scan-finalize-"));
  t.after(() => rmSync(thumbnailCacheDir, { recursive: true, force: true }));
  return thumbnailCacheDir;
}

test("finalizeScan: サムネイルGC後に last_scan_time を記録する", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);

  const scanStates = new Map<string, string | null>();
  const catalog = {
    setScanState: (key: string, value: string | null) => scanStates.set(key, value),
  };
  const query = {
    listSummaries: () => ({
      summaries: [],
      skipped: [],
      unmeasuredCovers: [],
    }),
  };

  await finalizeScan({
    query,
    catalog,
    thumbnailCacheDir,
    integrityLogContext: "scan-finalize-test",
  });

  assert.ok(scanStates.has(LAST_SCAN_TIME_KEY));
  assert.ok(scanStates.get(LAST_SCAN_TIME_KEY));
});

test("finalizeScan: throwIfCancelled が呼ばれたら last_scan_time を記録しない", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);

  const scanStates = new Map<string, string | null>();
  const catalog = {
    setScanState: (key: string, value: string | null) => scanStates.set(key, value),
  };
  const query = {
    listSummaries: () => ({
      summaries: [],
      skipped: [],
      unmeasuredCovers: [],
    }),
  };

  await assert.rejects(
    () =>
      finalizeScan({
        query,
        catalog,
        thumbnailCacheDir,
        throwIfCancelled: () => {
          throw new Error("cancelled");
        },
      }),
    /cancelled/,
  );
  assert.equal(scanStates.size, 0);
});

test("finalizeScan: 作品0件でも既存キャッシュは削除されず、メタ修正後の再スキャン後も残る", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);
  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-work-"));
  t.after(() => rmSync(workDir, { recursive: true, force: true }));
  const coverPath = join(workDir, "cover.jpg");
  await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .jpeg()
    .toFile(coverPath);

  mkdirSync(thumbnailCacheDir, { recursive: true });
  const { size, mtimeMs } = await stat(coverPath);
  const validName = `${createHash("sha256")
    .update(`work-fixed\0${THUMBNAIL_WIDTHS[0]}\0${size}\0${mtimeMs}`)
    .digest("hex")}.webp`;
  const cachedFile = join(thumbnailCacheDir, validName);
  writeFileSync(cachedFile, "cached");

  const scanStates = new Map<string, string | null>();
  const catalog = {
    setScanState: (key: string, value: string | null) => scanStates.set(key, value),
  };

  await finalizeScan({
    query: { listSummaries: () => ({ summaries: [], skipped: [], unmeasuredCovers: [] }) },
    catalog,
    thumbnailCacheDir,
  });
  assert.ok(existsSync(cachedFile), "全件メタ不正相当（作品0件）のスキャン後もキャッシュが残る");

  await finalizeScan({
    query: {
      listSummaries: () => ({
        summaries: [
          makeSummary({
            id: "work-fixed",
            physicalPath: workDir,
            cover: { image: "cover.jpg", dimensions: { width: 100, height: 100 } },
          }),
        ],
        skipped: [],
        unmeasuredCovers: [],
      }),
    },
    catalog,
    thumbnailCacheDir,
  });
  assert.ok(existsSync(cachedFile), "メタ修正後の再スキャン後も既存キャッシュが残る");
});

test("finalizeScan: listSummaries の skipped がある場合は削除されない", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);
  mkdirSync(thumbnailCacheDir, { recursive: true });
  const cachedFile = join(thumbnailCacheDir, "orphan.webp");
  writeFileSync(cachedFile, "orphan");

  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-work-"));
  t.after(() => rmSync(workDir, { recursive: true, force: true }));

  await finalizeScan({
    query: {
      listSummaries: () => ({
        summaries: [makeSummary({ id: "work-ok", physicalPath: workDir })],
        skipped: [{ workId: "work-bad", reason: "formatVersion missing" }],
        unmeasuredCovers: [],
      }),
    },
    catalog: { setScanState: () => {} },
    thumbnailCacheDir,
  });

  assert.ok(existsSync(cachedFile));
});

test("finalizeScan: resolveWithin 失敗がある場合は削除されない", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);
  mkdirSync(thumbnailCacheDir, { recursive: true });
  const cachedFile = join(thumbnailCacheDir, "orphan.webp");
  writeFileSync(cachedFile, "orphan");

  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-work-"));
  t.after(() => rmSync(workDir, { recursive: true, force: true }));

  await finalizeScan({
    query: {
      listSummaries: () => ({
        summaries: [
          makeSummary({
            id: "work-missing-cover",
            physicalPath: workDir,
            cover: { image: "missing-cover.jpg", dimensions: { width: 100, height: 100 } },
          }),
        ],
        skipped: [],
        unmeasuredCovers: [],
      }),
    },
    catalog: { setScanState: () => {} },
    thumbnailCacheDir,
  });

  assert.ok(existsSync(cachedFile));
});

test("finalizeScan: GCスキップ時も last_scan_time を更新する", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);
  const scanStates = new Map<string, string | null>();
  const catalog = {
    setScanState: (key: string, value: string | null) => scanStates.set(key, value),
  };

  await finalizeScan({
    query: { listSummaries: () => ({ summaries: [], skipped: [], unmeasuredCovers: [] }) },
    catalog,
    thumbnailCacheDir,
  });

  assert.ok(scanStates.has(LAST_SCAN_TIME_KEY));
});

test("finalizeScan: GCスキップ時に reason・件数・cacheDir を含む warn を出す", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);
  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-work-"));
  try {
    await captureLogs(async (records) => {
      await finalizeScan({
        query: {
          listSummaries: () => ({
            summaries: [makeSummary({ id: "work-1", physicalPath: workDir })],
            skipped: [{ workId: "work-bad", reason: "invalid" }],
            unmeasuredCovers: [],
          }),
        },
        catalog: { setScanState: () => {} },
        thumbnailCacheDir,
      });

      const warned = scanRecords(records).filter(
        (record) =>
          recordMessage(record) ===
          "スナップショットが不完全なためサムネイルキャッシュGCをスキップしました",
      );
      assert.equal(warned.length, 1);
      assert.equal(warned[0]!.level, "warning");
      assert.deepEqual(warned[0]!.properties.gaps, { "work-load-failed": 1 });
      assert.equal(warned[0]!.properties.workCount, 1);
      assert.equal(warned[0]!.properties.cacheDir, thumbnailCacheDir);
    });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("finalizeScan: 作品あり・全作品カバーなしの場合はGCが実行される", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);
  mkdirSync(thumbnailCacheDir, { recursive: true });
  const orphan = join(thumbnailCacheDir, "orphan.webp");
  writeFileSync(orphan, "orphan");

  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-work-"));
  t.after(() => rmSync(workDir, { recursive: true, force: true }));

  await finalizeScan({
    query: {
      listSummaries: () => ({
        summaries: [makeSummary({ id: "work-no-cover", physicalPath: workDir, cover: null })],
        skipped: [],
        unmeasuredCovers: [],
      }),
    },
    catalog: { setScanState: () => {} },
    thumbnailCacheDir,
  });

  assert.ok(!existsSync(orphan), "カバーなし作品のみでも孤児キャッシュは削除される");
});

test("finalizeScan: 寸法未計測カバーがある場合は削除されない", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);
  mkdirSync(thumbnailCacheDir, { recursive: true });
  const cachedFile = join(thumbnailCacheDir, "orphan.webp");
  writeFileSync(cachedFile, "orphan");

  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-work-"));
  t.after(() => rmSync(workDir, { recursive: true, force: true }));

  await finalizeScan({
    query: {
      listSummaries: () => ({
        summaries: [makeSummary({ id: "work-unmeasured", physicalPath: workDir, cover: null })],
        skipped: [],
        unmeasuredCovers: ["work-unmeasured"],
      }),
    },
    catalog: { setScanState: () => {} },
    thumbnailCacheDir,
  });

  assert.ok(existsSync(cachedFile));
});

test("finalizeScan: 寸法未計測カバーでGCスキップ時に unmeasured-covers warn を出す", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);
  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-work-"));
  try {
    await captureLogs(async (records) => {
      await finalizeScan({
        query: {
          listSummaries: () => ({
            summaries: [
              makeSummary({ id: "work-unmeasured", physicalPath: workDir, cover: null }),
              makeSummary({ id: "work-ok", physicalPath: workDir, cover: null }),
            ],
            skipped: [],
            unmeasuredCovers: ["work-unmeasured"],
          }),
        },
        catalog: { setScanState: () => {} },
        thumbnailCacheDir,
      });

      const warned = scanRecords(records).filter(
        (record) =>
          recordMessage(record) ===
          "スナップショットが不完全なためサムネイルキャッシュGCをスキップしました",
      );
      assert.equal(warned.length, 1);
      assert.deepEqual(warned[0]!.properties.gaps, { "cover-unmeasured": 1 });
      assert.equal(warned[0]!.properties.workCount, 2);
    });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("finalizeScan: 寸法未計測カバーでGCスキップ時も last_scan_time を更新する", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);
  const scanStates = new Map<string, string | null>();
  const catalog = {
    setScanState: (key: string, value: string | null) => scanStates.set(key, value),
  };
  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-work-"));
  t.after(() => rmSync(workDir, { recursive: true, force: true }));

  await finalizeScan({
    query: {
      listSummaries: () => ({
        summaries: [makeSummary({ id: "work-unmeasured", physicalPath: workDir, cover: null })],
        skipped: [],
        unmeasuredCovers: ["work-unmeasured"],
      }),
    },
    catalog,
    thumbnailCacheDir,
  });

  assert.ok(scanStates.has(LAST_SCAN_TIME_KEY));
});

test("finalizeScan: カバーの stat 失敗がある場合は削除されない", async (t) => {
  const thumbnailCacheDir = setupCacheDir(t);
  mkdirSync(thumbnailCacheDir, { recursive: true });
  const cachedFile = join(thumbnailCacheDir, "orphan.webp");
  writeFileSync(cachedFile, "orphan");

  const workDir = mkdtempSync(join(tmpdir(), "mimimilli-work-"));
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

  await finalizeScan({
    query: {
      listSummaries: () => ({
        summaries: [
          makeSummary({
            id: "work-stat-fail",
            physicalPath: workDir,
            cover: { image: "cover.jpg", dimensions: { width: 100, height: 100 } },
          }),
        ],
        skipped: [],
        unmeasuredCovers: [],
      }),
    },
    catalog: { setScanState: () => {} },
    thumbnailCacheDir,
  });

  assert.ok(existsSync(cachedFile));
});
