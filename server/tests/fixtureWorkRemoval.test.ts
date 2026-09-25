// fixtureの作品除去経路（deleteWork/unregisterMissingWorks/reassignIdentityConflict）が
// state.dlsiteLinkagesのエントリも一緒に扱うことを縛る。
import assert from "node:assert/strict";
import { test } from "node:test";
import { workspacePath, type WorkSummary } from "@mimimilli/shared";
import { createInitialState } from "../src/adapters/fixture/state.ts";
import { createWorkMethods } from "../src/adapters/fixture/works.ts";

function makeWork(id: string, overrides: Partial<WorkSummary> = {}): WorkSummary {
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 0,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: {
      rjCode: `RJ${id}`,
      status: "applied",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [],
    },
    ...overrides,
  };
}

test("deleteWorkは作品と一緒にdlsiteLinkagesのエントリも消す", async () => {
  const state = createInitialState({ works: [makeWork("w1"), makeWork("w2")] });
  const adapter = createWorkMethods(state);
  assert.ok(state.dlsiteLinkages.has("w1"));

  assert.equal(await adapter.deleteWork("w1"), true);
  assert.equal(state.dlsiteLinkages.has("w1"), false);
  assert.ok(state.dlsiteLinkages.has("w2"), "無関係な作品のlinkageは残る");
});

test("unregisterMissingWorksはmissingな作品のdlsiteLinkagesエントリだけ消す", async () => {
  const state = createInitialState({
    works: [makeWork("w1", { status: "missing" }), makeWork("w2", { status: "ok" })],
  });
  const adapter = createWorkMethods(state);

  const result = await adapter.unregisterMissingWorks();
  assert.deepEqual(result, { deletedCount: 1, failedCount: 0 });
  assert.equal(state.dlsiteLinkages.has("w1"), false);
  assert.ok(state.dlsiteLinkages.has("w2"));
});

test("deleteWorkは登録解除した作品のpathをidentity_conflict診断から外し、残り1pathなら診断ごと消す", async () => {
  const state = createInitialState({
    works: [makeWork("w1", { physicalPath: "/library/a" })],
  });
  state.identityConflicts = [{ kind: "identity_conflict", workId: "w1", paths: ["a", "b"] }];
  const adapter = createWorkMethods(state);

  assert.equal(await adapter.deleteWork("w1"), true);
  assert.deepEqual(state.identityConflicts, []);
});

test("deleteWorkは残りpathが2以上なら診断を残し、該当pathだけを外す", async () => {
  const state = createInitialState({
    works: [makeWork("w1", { physicalPath: "/library/a" })],
  });
  state.identityConflicts = [{ kind: "identity_conflict", workId: "w1", paths: ["a", "b", "c"] }];
  const adapter = createWorkMethods(state);

  assert.equal(await adapter.deleteWork("w1"), true);
  assert.deepEqual(state.identityConflicts, [
    { kind: "identity_conflict", workId: "w1", paths: ["b", "c"] },
  ]);
});

test("unregisterMissingWorksはmissingな作品のpathをidentity_conflict診断から外す", async () => {
  const state = createInitialState({
    works: [makeWork("w1", { status: "missing", physicalPath: "/library/a" })],
  });
  state.identityConflicts = [{ kind: "identity_conflict", workId: "w1", paths: ["a", "b"] }];
  const adapter = createWorkMethods(state);

  const result = await adapter.unregisterMissingWorks();
  assert.deepEqual(result, { deletedCount: 1, failedCount: 0 });
  assert.deepEqual(state.identityConflicts, []);
});

test("reassignIdentityConflictはdlsiteLinkagesを新idへ付け替える", async () => {
  const state = createInitialState({
    works: [makeWork("w1", { physicalPath: "/library/a" })],
  });
  state.identityConflicts = [{ kind: "identity_conflict", workId: "w1", paths: ["a", "b"] }];
  const adapter = createWorkMethods(state);
  const before = state.dlsiteLinkages.get("w1");

  const result = await adapter.reassignIdentityConflict({ path: workspacePath("a") });
  assert.ok(result);
  const newId = result!.snapshot.id;
  assert.notEqual(newId, "w1");
  assert.equal(state.dlsiteLinkages.has("w1"), false);
  assert.deepEqual(state.dlsiteLinkages.get(newId), before);
});
