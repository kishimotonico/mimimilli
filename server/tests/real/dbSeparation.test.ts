import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeSampleLibrary } from "../helpers/sampleLibrary.ts";

test("catalog削除後の再スキャンでもuser状態を保持し、ATTACH JOINで作品を読める", async (t) => {
  const library = makeSampleLibrary();
  t.after(library.cleanup);
  const catalogPath = join(library.baseDir, "data", "db", "catalog.sqlite");
  const userPath = join(library.baseDir, "data", "db", "user.sqlite");
  const database = { kind: "files" as const, catalogPath, userPath };

  const adapter = library.own(createTestRealAdapter({ database }));
  await adapter.updateSettings({ rootFolder: library.root });
  await adapter.scan();
  const before = await adapter.getWork(library.existingWorkId);
  assert.ok(before);
  const addedAt = before.addedAt;
  const playlist = before.playlists[0]!;
  const resumedTrack = playlist.tracks[1]!;
  assert.ok(await adapter.patchWork(library.existingWorkId, { bookmarked: true }));
  assert.ok(
    await adapter.saveResume(library.existingWorkId, {
      playlistId: playlist.id,
      trackId: resumedTrack.id,
      offsetSec: 12.5,
    }),
  );
  assert.ok(await adapter.touchLastPlayed(library.existingWorkId));
  assert.ok(
    await adapter.createTagPrefix({
      prefix: "気分",
      label: "気分",
      color: null,
      showAsAxis: true,
      protected: false,
    }),
  );
  await adapter.createSmartFolder({ name: "保持フォルダー", rules: [], sort: "added-desc" });
  adapter.close();

  assert.ok(existsSync(catalogPath));
  assert.ok(existsSync(userPath));
  const catalog = new Database(catalogPath, { readonly: true });
  catalog.run("ATTACH DATABASE ? AS user", [userPath]);
  const joined = catalog
    .query(
      "SELECT works.id, work_states.bookmarked FROM works " +
        "JOIN user.work_states ON work_states.work_id = works.id WHERE works.id = ?",
    )
    .get(library.existingWorkId) as { id: string; bookmarked: number } | null;
  assert.deepEqual(joined, { id: library.existingWorkId, bookmarked: 1 });
  const playlistRows = catalog
    .query("SELECT id, work_id AS workId, position, name FROM playlists WHERE work_id = ?")
    .all(library.existingWorkId) as Array<{
    id: string;
    workId: string;
    position: number;
    name: string;
  }>;
  assert.equal(playlistRows.length, 1);
  assert.equal(playlistRows[0]?.name, "default");
  assert.match(playlistRows[0]!.id, /^[0-9a-f-]{36}$/);
  const trackRows = catalog
    .query(
      "SELECT id, playlist_id AS playlistId, position FROM tracks WHERE work_id = ? ORDER BY position",
    )
    .all(library.existingWorkId) as Array<{ id: string; playlistId: string; position: number }>;
  assert.equal(trackRows.length, 2);
  assert.ok(trackRows.every((track) => track.playlistId === playlistRows[0]!.id));
  assert.equal(
    catalog
      .query("PRAGMA main.table_info(works)")
      .all()
      .some((row) =>
        ["added_at", "bookmarked", "last_played_at", "resume_position"].includes(
          (row as { name: string }).name,
        ),
      ),
    false,
  );
  assert.equal(catalog.query("PRAGMA user.foreign_key_list(work_states)").all().length, 0);
  catalog.close();

  rmSync(catalogPath);
  const rebuilt = library.own(createTestRealAdapter({ database }));
  assert.deepEqual(await rebuilt.getSettings(), { rootFolder: library.root, lastScanTime: null });
  await rebuilt.scan();

  const after = await rebuilt.getWork(library.existingWorkId);
  assert.ok(after);
  assert.equal(after.addedAt, addedAt);
  assert.equal(after.bookmarked, true);
  assert.deepEqual(after.resume, {
    playlistId: playlist.id,
    trackId: resumedTrack.id,
    offsetSec: 12.5,
  });
  assert.ok(after.lastPlayedAt);
  assert.ok((await rebuilt.listTagPrefixes()).some((prefix) => prefix.prefix === "気分"));
  assert.equal((await rebuilt.listSmartFolders())[0]?.name, "保持フォルダー");
});
