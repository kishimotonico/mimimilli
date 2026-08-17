// listDescendantWorkRefs / listFsWorkRefs の LIKE 子孫判定（アンダースコア境界）の回帰テスト。
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Work } from "@mimimilli/shared";
import { openDb } from "../../src/adapters/real/db.ts";
import { createWorkRepos, resolvedDuration, upsertTestWork } from "../helpers/workTestUtils.ts";
import { makeTestScope } from "../helpers/sampleLibrary.ts";

function sampleWork(id: string, physicalPath: string): Work {
  const playlistId = `${id}-playlist`;
  const trackId = `${id}-track`;
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath,
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
            id: trackId,
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

test("listDescendantWorkRefs: アンダースコア入りフォルダ名は別パスの作品を子孫と誤判定しない", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query, catalog, user } = createWorkRepos(db);
  const parentPath = "/library/A_B";
  const trueChildPath = "/library/A_B/child";
  const falseMatchPath = "/library/AXB/child";

  upsertTestWork(catalog, user, sampleWork("true-child", trueChildPath));
  upsertTestWork(catalog, user, sampleWork("false-match", falseMatchPath));

  const descendants = query.listDescendantWorkRefs(parentPath);
  assert.equal(descendants.length, 1);
  assert.equal(descendants[0]?.physicalPath, trueChildPath);
});

test("listFsWorkRefs: アンダースコア入り祖先パスは別パスの作品を子孫と誤判定しない", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query, catalog, user } = createWorkRepos(db);
  const ancestorPath = "/library/A_B";
  const trueChildPath = "/library/A_B/child";
  const falseMatchPath = "/library/AXB/child";

  upsertTestWork(catalog, user, sampleWork("true-child", trueChildPath));
  upsertTestWork(catalog, user, sampleWork("false-match", falseMatchPath));

  const refs = query.listFsWorkRefs(ancestorPath);
  const paths = refs.map((ref) => ref.physicalPath).sort();
  assert.deepEqual(paths, [trueChildPath]);
});
