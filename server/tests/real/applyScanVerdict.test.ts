// applyScanVerdict: missingIds だけを missing にし、それ以外の作品には触れないことの検証。
import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../../src/adapters/real/db.ts";
import {
  createWorkRepos,
  getTestWork,
  makeWork,
  upsertTestWork,
} from "../helpers/workTestUtils.ts";
import { makeTestScope } from "../helpers/sampleLibrary.ts";

test("missingIds の作品だけが missing になり、スキャン中に登録された作品は変わらない", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { catalog, user } = createWorkRepos(db);
  for (const id of ["keep-1", "keep-2", "lost-1", "registered-during-scan"]) {
    upsertTestWork(catalog, user, makeWork({ id }));
  }

  catalog.applyScanVerdict({
    seenIds: ["keep-1", "keep-2"],
    unverifiedIds: [],
    missingIds: ["lost-1"],
  });

  assert.equal((await getTestWork(db, "keep-1"))?.status, "ok");
  assert.equal((await getTestWork(db, "keep-2"))?.status, "ok");
  assert.equal((await getTestWork(db, "lost-1"))?.status, "missing");
  assert.equal((await getTestWork(db, "lost-1"))?.errorMessage, null);
  assert.equal((await getTestWork(db, "registered-during-scan"))?.status, "ok");
});

test("SQLiteパラメータ上限を超える大量IDでも動作する", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { catalog, user } = createWorkRepos(db);
  upsertTestWork(catalog, user, makeWork({ id: "keep-1" }));
  upsertTestWork(catalog, user, makeWork({ id: "lost-1" }));

  const many = Array.from({ length: 40_000 }, (_, i) => `other-${i}`);
  catalog.applyScanVerdict({
    seenIds: ["keep-1", ...many],
    unverifiedIds: [],
    missingIds: ["lost-1", ...many],
  });

  assert.equal((await getTestWork(db, "keep-1"))?.status, "ok");
  assert.equal((await getTestWork(db, "lost-1"))?.status, "missing");
});
