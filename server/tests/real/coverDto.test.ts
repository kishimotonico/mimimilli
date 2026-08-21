import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { emptyDlsiteState, type WorksPage } from "@mimimilli/shared";
import { createApp } from "../../src/app.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { createWorkRepos, folderMetaPath, resolvedDuration } from "../helpers/workTestUtils.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

const MISSING_COVER_WORK_ID = "missing-cover-file-work";

function seedWorkWithoutCoverFile(root: string) {
  const physicalPath = join(root, "dlsite", "RJ900010_欠損カバー");
  const playlistId = crypto.randomUUID();
  return {
    id: MISSING_COVER_WORK_ID,
    title: "カバー実体欠損作品",
    cover: null,
    coverKind: "measured" as const,
    coverImage: "cover.jpg",
    status: "ok" as const,
    physicalPath,
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

async function setupMissingCoverListQuery(t: TestContext) {
  const directory = makeTestDirectory("cover-dto-missing-file");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.db");
  const userPath = join(directory.path, "user.db");
  const root = join(directory.path, "lib");
  mkdirSync(root, { recursive: true });

  const work = seedWorkWithoutCoverFile(root);
  mkdirSync(work.physicalPath, { recursive: true });

  const db = openDb({ kind: "files", catalogPath, userPath });
  const { catalog, user } = createWorkRepos(db);
  user.upsertWorkUserState(work);
  catalog.upsertWorkCatalog(work, {
    metaPath: folderMetaPath(work.physicalPath),
    cover: { image: "cover.jpg", dimensions: { width: 100, height: 100 } },
  });
  db.close();

  const adapter = directory.own(
    createTestRealAdapter({ database: { kind: "files", catalogPath, userPath } }),
  );
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });
  return { app, work };
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
