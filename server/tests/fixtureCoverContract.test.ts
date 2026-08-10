import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyDlsiteState, type Work } from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { openDb } from "../src/adapters/real/db.ts";
import {
  createWorkRepos,
  folderMetaPath,
  getTestWork,
  resolvedDuration,
} from "./helpers/workTestUtils.ts";

const FIXTURE_UNMEASURED_ID = "RJ501003";
const REAL_UNMEASURED_ID = "cover-unmeasured-contract";

function coverContractSlice(work: Work) {
  return { cover: work.cover, coverKind: work.coverKind, coverImage: work.coverImage };
}

function minimalUnmeasuredWork(id: string): Work {
  const playlistId = crypto.randomUUID();
  return {
    id,
    title: "計測失敗カバー検証",
    cover: null,
    coverKind: "unmeasured",
    coverImage: "cover.jpg",
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 60,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
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
            file: "track.mp3",
            ...resolvedDuration(60),
          },
        ],
      },
    ],
    resume: null,
  };
}

test("fixture: RJ501003 は unmeasured カバーを返す", async () => {
  const work = await createFixtureAdapter().getWork(FIXTURE_UNMEASURED_ID);
  assert.ok(work);
  assert.deepEqual(coverContractSlice(work), {
    cover: null,
    coverKind: "unmeasured",
    coverImage: "cover.jpg",
  });
});

test("fixtureとreal: カバー列が unmeasured のとき編集用契約が同値", async () => {
  const fixtureWork = await createFixtureAdapter().getWork(FIXTURE_UNMEASURED_ID);
  assert.ok(fixtureWork);

  const db = openDb({ kind: "memory" });
  const { catalog, user } = createWorkRepos(db);
  const work = minimalUnmeasuredWork(REAL_UNMEASURED_ID);
  user.upsertWorkUserState(work);
  catalog.upsertWorkCatalog(work, {
    metaPath: folderMetaPath(work.physicalPath),
    cover: { image: "cover.jpg", dimensions: null },
  });

  const realWork = await getTestWork(db, REAL_UNMEASURED_ID);
  assert.ok(realWork);
  assert.deepEqual(coverContractSlice(fixtureWork), coverContractSlice(realWork));
});
