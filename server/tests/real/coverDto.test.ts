import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { axisFacetListSchema, emptyDlsiteState, type WorksPage } from "@mimimilli/shared";
import { createApp } from "../../src/app.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { createWorkRepos, folderMetaPath, resolvedDuration } from "../helpers/workTestUtils.ts";
import { makeTestDirectory, writeSampleCover } from "../helpers/sampleLibrary.ts";
import { configureRoot } from "../helpers/rootFolder.ts";

const MISSING_COVER_WORK_ID = "missing-cover-file-work";
const PRESENT_COVER_WORK_ID = "present-cover-file-work";

function seedMeasuredCoverWork(input: {
  id: string;
  title: string;
  physicalPath: string;
  addedAt: string;
}) {
  const playlistId = crypto.randomUUID();
  return {
    id: input.id,
    title: input.title,
    cover: null,
    coverKind: "measured" as const,
    coverImage: "cover.jpg",
    status: "ok" as const,
    physicalPath: input.physicalPath,
    totalDurationSec: 60,
    addedAt: input.addedAt,
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

function seedWorkWithoutCoverFile(root: string) {
  return seedMeasuredCoverWork({
    id: MISSING_COVER_WORK_ID,
    title: "カバー実体欠損作品",
    physicalPath: join(root, "dlsite", "RJ900010_欠損カバー"),
    addedAt: "2026-01-01T00:00:00.000Z",
  });
}

function seedWorkWithCoverFile(root: string) {
  return seedMeasuredCoverWork({
    id: PRESENT_COVER_WORK_ID,
    title: "カバー実体あり作品",
    physicalPath: join(root, "dlsite", "RJ900011_実体カバー"),
    addedAt: "2026-02-01T00:00:00.000Z",
  });
}

async function setupMissingCoverListQuery(t: TestContext) {
  const directory = makeTestDirectory("cover-dto-missing-file");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.db");
  const userPath = join(directory.path, "user.db");
  const root = join(directory.path, "lib");
  mkdirSync(root, { recursive: true });

  const work = seedWorkWithoutCoverFile(root);
  const presentWork = seedWorkWithCoverFile(root);
  mkdirSync(work.physicalPath, { recursive: true });
  mkdirSync(presentWork.physicalPath, { recursive: true });
  writeSampleCover(join(presentWork.physicalPath, "cover.jpg"));

  const db = openDb({ kind: "files", catalogPath, userPath });
  const { catalog, user } = createWorkRepos(db);
  for (const seeded of [work, presentWork]) {
    user.upsertWorkUserState(seeded);
    catalog.upsertWorkCatalog(seeded, {
      metaPath: folderMetaPath(seeded.physicalPath),
      cover: { image: "cover.jpg", dimensions: { width: 100, height: 100 } },
    });
  }
  db.close();

  const adapter = directory.own(
    createTestRealAdapter({ database: { kind: "files", catalogPath, userPath } }),
  );
  const app = createApp(adapter);
  await configureRoot(adapter, root);
  return { app, work, presentWork };
}

test("real: カバー実体欠損作品を含む一覧は成功し cover は null", async (t) => {
  const { app, work } = await setupMissingCoverListQuery(t);

  const res = await app.request("/api/works");
  assert.equal(res.status, 200);
  const page = (await res.json()) as WorksPage;
  const item = page.items.find((entry) => entry.id === work.id);
  assert.ok(item);
  assert.equal(item.cover, null);
});

test("real: カバー実体欠損作品は軸ファセットの covers から除外される", async (t) => {
  const { app, work, presentWork } = await setupMissingCoverListQuery(t);

  const res = await app.request("/api/axes/year");
  assert.equal(res.status, 200);
  const items = axisFacetListSchema.parse(await res.json());
  const year = items.find((item) => item.value === "2026");
  assert.ok(year);
  assert.equal(year.count, 2);
  assert.equal(year.covers.length, 1);
  assert.equal(year.covers[0]?.workId, presentWork.id);
  assert.equal(typeof year.covers[0]?.version, "string");
  assert.equal((year.covers[0]?.version.length ?? 0) > 0, true);
  assert.equal(
    year.covers.some((cover) => cover.workId === work.id),
    false,
  );
});
