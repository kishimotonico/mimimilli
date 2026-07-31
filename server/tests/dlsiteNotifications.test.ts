import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyDlsiteState,
  coverFieldsFromCover,
  type Work,
  type WorkSummary,
} from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createApp } from "../src/app.ts";
import { openDb } from "../src/adapters/real/db.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { WorkRepo } from "../src/adapters/real/workRepo.ts";
import { upsertTestWork } from "./helpers/workTestUtils.ts";
import { makeSampleLibrary } from "./helpers/sampleLibrary.ts";

function notificationWorks(count: number): WorkSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `work-${String(index).padStart(3, "0")}`,
    title: `作品 ${String(count - index).padStart(3, "0")}`,
    cover: null,
    status: "ok" as const,
    physicalPath: `/library/${index}`,
    totalDurationSec: 0,
    addedAt: "2026-07-23T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: index % 2 === 0 ? ["サークル/テスト"] : [],
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite:
      index < 201
        ? emptyDlsiteState()
        : {
            rjCode: "RJ123456",
            status: "error" as const,
            lastAttemptAt: null,
            error: "failed",
            errorKind: null,
            appliedTags: [],
          },
  }));
}

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

test("DLsite通知は通常works一覧と別契約で集計・ページングする", async () => {
  const app = createApp(createFixtureAdapter());
  const summaryResponse = await app.request("/api/dlsite/notifications");
  assert.equal(summaryResponse.status, 200);
  const summary = (await summaryResponse.json()) as {
    rjCodeMissingCount: number;
    fetchFailedCount: number;
    parseErrorCount: number;
    parseErrorAlert: boolean;
    unlinkedCount: number;
  };
  assert.ok(summary.rjCodeMissingCount >= 0);
  assert.ok(summary.fetchFailedCount >= 0);
  assert.ok(summary.parseErrorCount >= 0);
  assert.equal(typeof summary.parseErrorAlert, "boolean");
  assert.ok(summary.unlinkedCount >= 0);

  const listResponse = await app.request("/api/dlsite/notifications/rj-missing?page=1&limit=1");
  assert.equal(listResponse.status, 200);
  const list = (await listResponse.json()) as {
    items: Array<Record<string, unknown>>;
    total: number;
  };
  assert.ok(list.total >= list.items.length);
  for (const item of list.items) {
    assert.deepEqual(Object.keys(item).sort(), ["id", "rjCode", "status", "title"]);
  }
});

test("DLsite通知のページングパラメータが不正なら400", async () => {
  const app = createApp(createFixtureAdapter());
  for (const query of ["?page=0", "?limit=0", "?limit=501", "?page=x"]) {
    const response = await app.request(`/api/dlsite/notifications/fetch-failed${query}`);
    assert.equal(response.status, 400, query);
  }
});

test("201件超の通知はfixtureとrealで集計・ページングの欠落や重複がない", async () => {
  const works = notificationWorks(402);
  const fixture = createFixtureAdapter({ works });
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  try {
    for (const work of works) upsertTestWork(repo, asWork(work));
    const fixtureSummary = await fixture.getDlsiteNotificationSummary();
    const realSummary = repo.getDlsiteNotificationSummary();
    assert.deepEqual(realSummary, fixtureSummary);

    for (const kind of ["rj-missing", "fetch-failed"] as const) {
      const fixtureFirst = await fixture.queryDlsiteNotifications(kind, { page: 1, limit: 200 });
      const fixtureSecond = await fixture.queryDlsiteNotifications(kind, { page: 2, limit: 200 });
      const realFirst = repo.queryDlsiteNotifications(kind, { page: 1, limit: 200 });
      const realSecond = repo.queryDlsiteNotifications(kind, { page: 2, limit: 200 });
      assert.deepEqual(realFirst, fixtureFirst, `${kind}: 1ページ目`);
      assert.deepEqual(realSecond, fixtureSecond, `${kind}: 2ページ目`);
      const ids = [...realFirst.items, ...realSecond.items].map((item) => item.id);
      assert.equal(new Set(ids).size, ids.length, `${kind}: 重複があります`);
      assert.equal(ids.length, realFirst.total, `${kind}: 末尾ページが欠落しています`);
      assert.ok(realSecond.items.length > 0, `${kind}: 201件目以降が取得されていません`);
    }
  } finally {
    db.close();
  }
});

test("DLsite通知: parse_error は fetch-failed と分離して集計する", async () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  try {
    const parseFailed: WorkSummary = {
      id: "parse-1",
      title: "パース失敗",
      cover: null,
      status: "ok" as const,
      physicalPath: "/library/parse",
      totalDurationSec: 0,
      addedAt: "2026-07-26T00:00:00.000Z",
      errorMessage: null,
      urls: [],
      tags: [],
      trackCount: 0,
      bookmarked: false,
      lastPlayedAt: null,
      dlsite: {
        rjCode: "RJ111111",
        status: "error" as const,
        lastAttemptAt: null,
        error: "parse",
        errorKind: "parse_error" as const,
        appliedTags: [],
      },
    };
    const httpFailed: WorkSummary = {
      ...parseFailed,
      id: "http-1",
      title: "HTTP失敗",
      dlsite: {
        rjCode: "RJ222222",
        status: "error" as const,
        lastAttemptAt: null,
        error: "http",
        errorKind: "error" as const,
        appliedTags: [],
      },
    };
    upsertTestWork(repo, asWork(parseFailed));
    upsertTestWork(repo, asWork(httpFailed));
    assert.deepEqual(repo.getDlsiteNotificationSummary(), {
      rjCodeMissingCount: 0,
      fetchFailedCount: 1,
      parseErrorCount: 1,
      parseErrorAlert: false,
      unlinkedCount: 0,
    });
    assert.deepEqual(repo.queryDlsiteNotifications("parse-failed", { page: 1, limit: 10 }), {
      items: [{ id: "parse-1", title: "パース失敗", status: "error", rjCode: "RJ111111" }],
      total: 1,
    });
  } finally {
    db.close();
  }
});

test("real adapter経由のHTTP一覧もWorkListItemの許可キーだけを返す", async () => {
  const library = makeSampleLibrary();
  const adapter = createTestRealAdapter({
    database: { kind: "memory" },
    dataRoot: library.baseDir,
  });
  try {
    await adapter.updateSettings({ rootFolder: library.root });
    await adapter.scan();
    const response = await createApp(adapter).request("/api/works?limit=1");
    assert.equal(response.status, 200);
    const body = (await response.json()) as { items: Array<Record<string, unknown>> };
    assert.deepEqual(Object.keys(body.items[0]!).sort(), [
      "bookmarked",
      "circleName",
      "cover",
      "id",
      "lastPlayedAt",
      "status",
      "title",
      "totalDurationSec",
      "trackCount",
    ]);
  } finally {
    adapter.close();
    library.cleanup();
  }
});
