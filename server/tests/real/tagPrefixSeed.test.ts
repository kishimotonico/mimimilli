// real アダプタの prefix 定義 seed（ADR-0005）のテスト。
// seed はファイル DB の初回のみで、全削除しても再 seed されないことを確認する。
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DEFAULT_TAG_PREFIXES } from "@mimimilli/shared";
import { createRealAdapter } from "../../src/adapters/real/index.ts";

test("初回起動で DEFAULT_TAG_PREFIXES が seed され、全削除後の再起動で再 seed されない", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mimimilli-tagprefix-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dbPath = join(dir, "test.db");

  const adapter = createRealAdapter({ dbPath });
  const seeded = await adapter.listTagPrefixes();
  assert.deepEqual(
    seeded.map((p) => p.prefix),
    DEFAULT_TAG_PREFIXES.map((p) => p.prefix),
  );

  for (const def of seeded) {
    assert.ok(await adapter.deleteTagPrefix(def.prefix));
  }
  assert.deepEqual(await adapter.listTagPrefixes(), []);

  // 再起動相当: 同じ DB ファイルでアダプタを作り直す
  const reopened = createRealAdapter({ dbPath });
  assert.deepEqual(await reopened.listTagPrefixes(), []);
});

test("real アダプタで prefix 定義の CRUD が動く", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mimimilli-tagprefix-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const adapter = createRealAdapter({ dbPath: join(dir, "test.db") });

  const created = await adapter.createTagPrefix({
    prefix: "気分",
    label: "気分",
    color: null,
    showAsAxis: true,
    protected: false,
  });
  assert.equal(created?.prefix, "気分");

  // 重複は null
  assert.equal(
    await adapter.createTagPrefix({
      prefix: "気分",
      label: "気分2",
      color: null,
      showAsAxis: true,
      protected: false,
    }),
    null,
  );

  const updated = await adapter.updateTagPrefix("気分", { protected: true });
  assert.equal(updated?.protected, true);

  assert.ok(await adapter.deleteTagPrefix("気分"));
  assert.equal(await adapter.updateTagPrefix("気分", { label: "x" }), null);
});
