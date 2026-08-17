// TASK-57: listSummaries の N+1 解消と軽量投影の検証。
// SQL 発行数が作品数に比例しないこととtrack_count列の維持を確認する。
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ResolvedPlaylist, Work } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import { openDb, type Db } from "../../src/adapters/real/db.ts";
import { workDlsite } from "../../src/adapters/real/catalogSchema.ts";
import type { WorkQueryRepository } from "../../src/adapters/real/workQueryRepository.ts";
import {
  upsertTestWork,
  resolvedDuration,
  createWorkRepos,
  folderMetaPath,
} from "../helpers/workTestUtils.ts";
import { eq } from "drizzle-orm";

function makePlaylist(trackCount: number, id = crypto.randomUUID()): ResolvedPlaylist {
  return {
    id,
    name: "default",
    tracks: Array.from({ length: trackCount }, (_, i) => ({
      id: crypto.randomUUID(),
      title: `track-${i + 1}`,
      file: `track-${i + 1}.wav`,
      ...resolvedDuration(60),
    })),
  };
}

function sampleWork(
  id: string,
  playlists: ResolvedPlaylist[],
  defaultPlaylistId: string | null,
): Work {
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 10,
    addedAt: "2026-07-19T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    defaultPlaylistId,
    createdAt: null,
    playlists,
    bookmarked: false,
    lastPlayedAt: null,
    resume: null,
    dlsite: {
      rjCode: null,
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [],
    },
  };
}

function trackCountOf(query: WorkQueryRepository, id: string): number {
  const summary = query.listSummaries().summaries.find((s) => s.id === id);
  assert.ok(summary, `listSummaries に ${id} がありません`);
  return summary.trackCount;
}

test("track_count はデフォルトプレイリスト指定ありなら指定PLのトラック数", () => {
  const db = openDb({ kind: "memory" });
  const { query, catalog, user } = createWorkRepos(db);
  const first = makePlaylist(3);
  const second = makePlaylist(1);
  upsertTestWork(catalog, user, sampleWork("w-1", [first, second], second.id));
  assert.equal(trackCountOf(query, "w-1"), 1);
  db.close();
});

test("track_count はデフォルトプレイリスト指定なしなら先頭PLのトラック数", () => {
  const db = openDb({ kind: "memory" });
  const { query, catalog, user } = createWorkRepos(db);
  upsertTestWork(catalog, user, sampleWork("w-1", [makePlaylist(3), makePlaylist(1)], null));
  assert.equal(trackCountOf(query, "w-1"), 3);
  db.close();
});

test("track_count はプレイリストなしなら0", () => {
  const db = openDb({ kind: "memory" });
  const { query, catalog, user } = createWorkRepos(db);
  upsertTestWork(catalog, user, sampleWork("w-1", [], null));
  assert.equal(trackCountOf(query, "w-1"), 0);
  db.close();
});

test("track_count は update でも再計算される", () => {
  const db = openDb({ kind: "memory" });
  const { query, catalog, user } = createWorkRepos(db);
  const work = sampleWork("w-1", [makePlaylist(2)], null);
  upsertTestWork(catalog, user, work);
  assert.equal(trackCountOf(query, "w-1"), 2);

  upsertTestWork(catalog, user, { ...work, playlists: [makePlaylist(5)] });
  assert.equal(trackCountOf(query, "w-1"), 5);
  db.close();
});

test("listSummaries の SQL 発行数は作品数に依存しない", () => {
  const db = openDb({ kind: "memory" });
  const { query, catalog, user } = createWorkRepos(db);

  const countQueries = (): number => {
    let count = 0;
    const original = db.sqlite.query.bind(db.sqlite);
    db.sqlite.query = ((sql: string) => {
      count += 1;
      return original(sql);
    }) as Db["sqlite"]["query"];
    try {
      query.listSummaries();
    } finally {
      db.sqlite.query = original;
    }
    return count;
  };

  upsertTestWork(catalog, user, sampleWork("w-1", [makePlaylist(1)], null));
  const n1 = countQueries();
  assert.ok(n1 > 0, "計測対象のクエリが発行されていません");

  for (let i = 2; i <= 100; i++) {
    upsertTestWork(catalog, user, sampleWork(`w-${i}`, [makePlaylist(1)], null));
  }
  const n100 = countQueries();
  assert.equal(n100, n1, `SQL 発行数が作品数に比例しています (N=1: ${n1}, N=100: ${n100})`);
  db.close();
});

test("work_dlsite 行がない作品は emptyDlsiteState() になる", () => {
  const db = openDb({ kind: "memory" });
  const { query, catalog, user } = createWorkRepos(db);
  upsertTestWork(catalog, user, sampleWork("w-1", [makePlaylist(1)], null));
  db.catalog.delete(workDlsite).where(eq(workDlsite.workId, "w-1")).run();

  const summary = query.listSummaries().summaries.find((s) => s.id === "w-1");
  assert.deepEqual(summary?.dlsite, {
    rjCode: null,
    status: "none",
    lastAttemptAt: null,
    error: null,
    errorKind: null,
    appliedTags: [],
  });
  db.close();
});

function unmeasuredWork(id: string): Work {
  const playlistId = crypto.randomUUID();
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    coverKind: "unmeasured",
    coverImage: "cover.jpg",
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 10,
    addedAt: "2026-07-19T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          {
            id: crypto.randomUUID(),
            title: "track",
            file: "track.wav",
            ...resolvedDuration(60),
          },
        ],
      },
    ],
    bookmarked: false,
    lastPlayedAt: null,
    resume: null,
    dlsite: emptyDlsiteState(),
  };
}

test("listSummaries: 寸法未計測カバーがないとき unmeasuredCovers は空", () => {
  const db = openDb({ kind: "memory" });
  const { query, catalog, user } = createWorkRepos(db);
  upsertTestWork(catalog, user, sampleWork("w-1", [makePlaylist(1)], null));
  assert.deepEqual(query.listSummaries().unmeasuredCovers, []);
  db.close();
});

test("listSummaries: 寸法未計測カバーの作品IDを返す", () => {
  const db = openDb({ kind: "memory" });
  const { query, catalog, user } = createWorkRepos(db);
  upsertTestWork(catalog, user, sampleWork("w-none", [makePlaylist(1)], null));
  const unmeasured = unmeasuredWork("w-unmeasured");
  user.upsertWorkUserState(unmeasured);
  catalog.upsertWorkCatalog(unmeasured, {
    metaPath: folderMetaPath(unmeasured.physicalPath),
    cover: { image: "cover.jpg", dimensions: null },
  });
  assert.deepEqual(query.listSummaries().unmeasuredCovers, ["w-unmeasured"]);
  db.close();
});
