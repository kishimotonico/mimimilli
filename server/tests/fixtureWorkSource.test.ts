import assert from "node:assert/strict";
import { test } from "node:test";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { nt } from "./helpers/tag.ts";

test("fixture: no-op の PUT/DELETE は sourceRevision を変えない", async () => {
  const adapter = createFixtureAdapter();
  const workId = "RJ501001";
  const before = await adapter.getWorkEditSnapshot(workId);
  assert.ok(before);
  const putSame = await adapter.addWorkTag(workId, nt("cv/水瀬なずな"));
  assert.ok(putSame);
  assert.equal(putSame.snapshot.sourceRevision, before.sourceRevision);
  const delMissing = await adapter.removeWorkTag(workId, nt("存在しないタグ"));
  assert.ok(delMissing);
  assert.equal(delMissing.snapshot.sourceRevision, before.sourceRevision);
  const putNew = await adapter.addWorkTag(workId, nt("新しいタグ"));
  assert.ok(putNew);
  assert.notEqual(putNew.snapshot.sourceRevision, before.sourceRevision);
});
