import assert from "node:assert/strict";
import { test } from "node:test";
import { workspacePath, type ScanResult } from "@mimimilli/shared";
import { ScanRecordStore } from "../src/scanRecord.ts";

function result(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    registered: 0,
    insertedWorkIds: [],
    startedWithEmptyCatalog: false,
    missingWorks: [],
    updatedWorks: [],
    errors: 0,
    missing: 0,
    skipped: 0,
    coverErrors: 0,
    unreadablePaths: [],
    ...overrides,
  };
}

test("未スキャンの記録は finishedAt が null の空", () => {
  const store = new ScanRecordStore();
  assert.deepEqual(store.snapshot(), {
    finishedAt: null,
    updatedWorks: [],
    missingWorks: [],
    unreadablePaths: [],
  });
  assert.deepEqual(store.workIds("new"), []);
});

test("置換で前回の記録が入れ替わる", () => {
  const store = new ScanRecordStore();
  store.replace(result({ insertedWorkIds: ["a"] }), "t1");
  store.addNewWorks(["b"]);
  store.replace(result({ insertedWorkIds: ["c"] }), "t2");
  assert.deepEqual(store.workIds("new"), ["c"]);
  assert.equal(store.snapshot().finishedAt, "t2");
});

test("開始時にcatalogが空のスキャンは新規作品を空にする", () => {
  const store = new ScanRecordStore();
  store.replace(result({ insertedWorkIds: ["a", "b"], startedWithEmptyCatalog: true }), "t");
  assert.deepEqual(store.workIds("new"), []);
});

test("スキャン実行中に追加した作品は完了後の記録にも残る", () => {
  const store = new ScanRecordStore();
  store.addNewWorks(["before"]);
  store.beginScan();
  store.addNewWorks(["during"]);
  store.replace(result({ insertedWorkIds: ["x"], startedWithEmptyCatalog: true }), "t");
  assert.deepEqual(store.workIds("new"), ["during"]);
  store.replace(result(), "t2");
  assert.deepEqual(store.workIds("new"), []);
});

test("updated は変化の種類で絞れる", () => {
  const store = new ScanRecordStore();
  store.replace(
    result({
      updatedWorks: [
        {
          workId: "m",
          changes: [{ kind: "moved", from: workspacePath("a"), to: workspacePath("b") }],
        },
        { workId: "f", changes: [{ kind: "files", audioDelta: 1 }, { kind: "meta" }] },
      ],
    }),
    "t",
  );
  assert.deepEqual(store.workIds("updated"), ["m", "f"]);
  assert.deepEqual(store.workIds("updated", "moved"), ["m"]);
  assert.deepEqual(store.workIds("updated", "meta"), ["f"]);
});

test("forgetWork は全項目から外し、データ不整合は件数を揃えて空なら警告ごと消える", () => {
  const store = new ScanRecordStore();
  store.replace(
    result({
      insertedWorkIds: ["w"],
      updatedWorks: [{ workId: "w", changes: [{ kind: "meta" }] }],
      missingWorks: [{ workId: "w", title: "t", previousPath: workspacePath("p") }],
      dataIntegrityWarning: { skippedCount: 2, skippedWorkIds: ["w", "z"] },
    }),
    "t",
  );
  store.forgetWork("w");
  const snapshot = store.snapshot();
  assert.deepEqual(store.workIds("new"), []);
  assert.deepEqual(snapshot.updatedWorks, []);
  assert.deepEqual(snapshot.missingWorks, []);
  assert.deepEqual(snapshot.dataIntegrityWarning, { skippedCount: 1, skippedWorkIds: ["z"] });
  store.resolveDataIntegrity("z");
  assert.equal(store.snapshot().dataIntegrityWarning, undefined);
});

test("reset で空に戻る", () => {
  const store = new ScanRecordStore();
  store.replace(result({ insertedWorkIds: ["a"] }), "t");
  store.reset();
  assert.equal(store.snapshot().finishedAt, null);
  assert.deepEqual(store.workIds("new"), []);
});

test("スキャン実行中に登録解除・読み直しした作品は、完了時の新しい記録に戻らない", () => {
  const store = new ScanRecordStore();
  store.beginScan();
  store.forgetWork("gone");
  store.resolveDataIntegrity("fixed");
  store.replace(
    result({
      insertedWorkIds: ["gone", "keep"],
      updatedWorks: [{ workId: "gone", changes: [{ kind: "meta" }] }],
      missingWorks: [{ workId: "gone", title: "t", previousPath: workspacePath("p") }],
      dataIntegrityWarning: { skippedCount: 2, skippedWorkIds: ["fixed", "other"] },
    }),
    "t",
  );
  const snapshot = store.snapshot();
  assert.deepEqual(store.workIds("new"), ["keep"]);
  assert.deepEqual(snapshot.updatedWorks, []);
  assert.deepEqual(snapshot.missingWorks, []);
  assert.deepEqual(snapshot.dataIntegrityWarning, { skippedCount: 1, skippedWorkIds: ["other"] });

  store.replace(
    result({ dataIntegrityWarning: { skippedCount: 1, skippedWorkIds: ["fixed"] } }),
    "t2",
  );
  assert.equal(store.snapshot().dataIntegrityWarning?.skippedCount, 1);
});

test("中止・失敗でスキャンが終わると、実行中の引き継ぎ履歴は捨てられる", () => {
  const store = new ScanRecordStore();
  store.beginScan();
  store.addNewWorks(["added"]);
  store.forgetWork("gone");
  store.endScan();
  store.replace(result({ insertedWorkIds: ["gone"] }), "t");
  assert.deepEqual(store.workIds("new"), ["gone"]);
});
