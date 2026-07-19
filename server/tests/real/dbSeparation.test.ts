import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { makeSampleLibrary } from "../helpers/sampleLibrary.ts";

test("catalog削除後の再スキャンでもuser状態を保持し、ATTACH JOINで作品を読める", async (t) => {
  const library = makeSampleLibrary();
  t.after(library.cleanup);
  const catalogPath = join(library.baseDir, "data", "db", "catalog.sqlite");
  const userPath = join(library.baseDir, "data", "db", "user.sqlite");
  const database = { kind: "files" as const, catalogPath, userPath };

  const adapter = createRealAdapter({ database });
  await adapter.updateSettings({ rootFolder: library.root });
  await adapter.scan();
  const before = await adapter.getWork(library.existingWorkId);
  assert.ok(before);
  const addedAt = before.addedAt;
  assert.ok(await adapter.patchWork(library.existingWorkId, { bookmarked: true }));
  assert.ok(await adapter.saveResume(library.existingWorkId, { position: 12.5, trackIndex: 1 }));
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
  await adapter.createPreset({
    name: "保持プリセット",
    query: "耳かき",
    tagFilters: ["気分/静か"],
    sortId: "title-asc",
  });
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
  const rebuilt = createRealAdapter({ database });
  assert.deepEqual(await rebuilt.getSettings(), { rootFolder: library.root, lastScanTime: null });
  await rebuilt.scan();

  const after = await rebuilt.getWork(library.existingWorkId);
  assert.ok(after);
  assert.equal(after.addedAt, addedAt);
  assert.equal(after.bookmarked, true);
  assert.equal(after.resumePosition, 12.5);
  assert.equal(after.resumeTrackIndex, 1);
  assert.ok(after.lastPlayedAt);
  assert.ok((await rebuilt.listTagPrefixes()).some((prefix) => prefix.prefix === "気分"));
  assert.equal((await rebuilt.listPresets())[0]?.name, "保持プリセット");
  assert.equal((await rebuilt.listSmartFolders())[0]?.name, "保持フォルダー");
  rebuilt.close();
});
