// listDescendantWorkRefs / listFsWorkRefs の LIKE 子孫判定（アンダースコア境界）の回帰テスト。
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Work } from "@mimimilli/shared";
import { openDb } from "../../src/adapters/real/db.ts";
import { WorkRepo } from "../../src/adapters/real/workRepo.ts";
import { resolvedDuration, upsertTestWork } from "../helpers/workTestUtils.ts";

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

test("listDescendantWorkRefs: アンダースコア入りフォルダ名は別パスの作品を子孫と誤判定しない", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const parentPath = "/library/A_B";
  const trueChildPath = "/library/A_B/child";
  const falseMatchPath = "/library/AXB/child";

  upsertTestWork(repo, sampleWork("true-child", trueChildPath));
  upsertTestWork(repo, sampleWork("false-match", falseMatchPath));

  const descendants = repo.listDescendantWorkRefs(parentPath);
  assert.equal(descendants.length, 1);
  assert.equal(descendants[0]?.physicalPath, trueChildPath);
  db.close();
});

test("listFsWorkRefs: アンダースコア入り祖先パスは別パスの作品を子孫と誤判定しない", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const ancestorPath = "/library/A_B";
  const trueChildPath = "/library/A_B/child";
  const falseMatchPath = "/library/AXB/child";

  upsertTestWork(repo, sampleWork("true-child", trueChildPath));
  upsertTestWork(repo, sampleWork("false-match", falseMatchPath));

  const refs = repo.listFsWorkRefs(ancestorPath);
  const paths = refs.map((ref) => ref.physicalPath).sort();
  assert.deepEqual(paths, [trueChildPath]);
  db.close();
});
