import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { openDb } from "../src/adapters/real/db.ts";
import { captureLogs, categoryRecords, recordMessage } from "./helpers/logCapture.ts";

function dbFailureRecords(records: ReturnType<typeof categoryRecords>) {
  return records.filter(
    (record) => recordMessage(record) === "データベースのオープンに失敗しました",
  );
}

test("catalog の open 失敗時に kind・dbPath・phase を記録する", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "mimimilli-db-open-"));
  try {
    const catalogPath = join(baseDir, "catalog-dir");
    const userPath = join(baseDir, "user.sqlite");
    mkdirSync(catalogPath, { recursive: true });

    await captureLogs(
      async (records) => {
        assert.throws(
          () =>
            openDb({
              kind: "files",
              catalogPath,
              userPath,
            }),
          /unable to open database file|SQLITE_CANTOPEN|database/i,
        );

        const logged = dbFailureRecords(categoryRecords(records, "db"));
        assert.equal(logged.length, 1);
        assert.equal(logged[0]!.level, "error");
        assert.equal(logged[0]!.properties.kind, "catalog");
        assert.equal(logged[0]!.properties.dbPath, catalogPath);
        assert.equal(logged[0]!.properties.phase, "open");
        assert.equal(typeof logged[0]!.properties.message, "string");
      },
      { categories: ["db"] },
    );
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
});

test("user の open 失敗時に kind=user と phase=open を記録する", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "mimimilli-db-user-open-"));
  try {
    const catalogPath = join(baseDir, "catalog.sqlite");
    const userPath = join(baseDir, "user-dir");
    mkdirSync(userPath, { recursive: true });

    await captureLogs(
      async (records) => {
        assert.throws(
          () =>
            openDb({
              kind: "files",
              catalogPath,
              userPath,
            }),
          /unable to open database file|SQLITE_CANTOPEN|database/i,
        );

        const logged = dbFailureRecords(categoryRecords(records, "db"));
        const userLog = logged.find(
          (record) => record.properties.kind === "user" && record.properties.phase === "open",
        );
        assert.ok(userLog);
        assert.equal(userLog!.properties.dbPath, userPath);
        assert.equal(userLog!.level, "error");
      },
      { categories: ["db"] },
    );
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
});

test("親ディレクトリ作成の mkdir 失敗時に kind・dbPath・phase=open と errno 情報を記録する", async () => {
  const baseDir = mkdtempSync(join(tmpdir(), "mimimilli-db-mkdir-"));
  try {
    const blockerPath = join(baseDir, "notadir");
    writeFileSync(blockerPath, "blocked");
    const catalogPath = join(blockerPath, "db", "catalog.sqlite");
    const userPath = join(baseDir, "user.sqlite");

    await captureLogs(
      async (records) => {
        assert.throws(
          () =>
            openDb({
              kind: "files",
              catalogPath,
              userPath,
            }),
          (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /ENOTDIR|not a directory/i);
            return true;
          },
        );

        const logged = dbFailureRecords(categoryRecords(records, "db"));
        assert.equal(logged.length, 1);
        assert.equal(logged[0]!.level, "error");
        assert.equal(logged[0]!.properties.kind, "catalog");
        assert.equal(logged[0]!.properties.dbPath, catalogPath);
        assert.equal(logged[0]!.properties.phase, "open");
        assert.equal("sqliteCode" in logged[0]!.properties, false);
        assert.match(String(logged[0]!.properties.message), /ENOTDIR|not a directory/i);
      },
      { categories: ["db"] },
    );
  } finally {
    rmSync(baseDir, { recursive: true, force: true });
  }
});
