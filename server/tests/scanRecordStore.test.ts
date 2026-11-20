import assert from "node:assert/strict";
import { test } from "node:test";
import { workspacePath, type ScanResult } from "@mimimilli/shared";
import { ScanRecordStore, type ExistingWorkStatuses } from "../src/scanRecord.ts";

/** 記録した作品がすべて存在し、行方不明のままである状態 */
function allExist(store: ScanRecordStore): ExistingWorkStatuses {
  return new Map(store.snapshotWorkIds().map((id) => [id, "missing" as const]));
}

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
  assert.deepEqual(store.snapshot(allExist(store)), {
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
  assert.equal(store.snapshot(allExist(store)).finishedAt, "t2");
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

test("snapshot は存在しない作品を落とし、新たな行方不明は存在してかつ行方不明のままのものだけ残す", () => {
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

  const gone = store.snapshot(new Map([["z", "ok"]]));
  assert.deepEqual(gone.updatedWorks, []);
  assert.deepEqual(gone.missingWorks, []);
  assert.deepEqual(gone.dataIntegrityWarning, { skippedCount: 1, skippedWorkIds: ["z"] });

  const restored = store.snapshot(new Map([["w", "ok"]]));
  assert.equal(restored.updatedWorks.length, 1);
  assert.deepEqual(restored.missingWorks, []);
  assert.deepEqual(restored.dataIntegrityWarning, { skippedCount: 1, skippedWorkIds: ["w"] });

  assert.equal(store.snapshot(new Map()).dataIntegrityWarning, undefined);
  store.resolveDataIntegrity("z");
  store.resolveDataIntegrity("w");
  assert.equal(store.snapshot(allExist(store)).dataIntegrityWarning, undefined);
});

test("reset で空に戻る", () => {
  const store = new ScanRecordStore();
  store.replace(result({ insertedWorkIds: ["a"] }), "t");
  store.reset();
  assert.equal(store.snapshot(allExist(store)).finishedAt, null);
  assert.deepEqual(store.workIds("new"), []);
});

test("スキャン実行中に読み直しで直った作品は完了時の新しい記録に戻らない", () => {
  const store = new ScanRecordStore();
  store.beginScan();
  store.resolveDataIntegrity("fixed");
  store.replace(
    result({ dataIntegrityWarning: { skippedCount: 2, skippedWorkIds: ["fixed", "other"] } }),
    "t",
  );
  const snapshot = store.snapshot(allExist(store));
  assert.deepEqual(snapshot.dataIntegrityWarning, { skippedCount: 1, skippedWorkIds: ["other"] });

  store.replace(
    result({ dataIntegrityWarning: { skippedCount: 1, skippedWorkIds: ["fixed"] } }),
    "t2",
  );
  assert.equal(store.snapshot(allExist(store)).dataIntegrityWarning?.skippedCount, 1);
});

test("中止・失敗でスキャンが終わると、実行中の引き継ぎ履歴は捨てられる", () => {
  const store = new ScanRecordStore();
  store.beginScan();
  store.addNewWorks(["added"]);
  store.resolveDataIntegrity("fixed");
  store.endScan();
  store.replace(
    result({
      insertedWorkIds: ["inserted"],
      dataIntegrityWarning: { skippedCount: 1, skippedWorkIds: ["fixed"] },
    }),
    "t",
  );
  assert.deepEqual(store.workIds("new"), ["inserted"]);
  assert.equal(store.snapshot(allExist(store)).dataIntegrityWarning?.skippedCount, 1);
});
