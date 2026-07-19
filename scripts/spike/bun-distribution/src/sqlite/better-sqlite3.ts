import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const phase = process.argv[2];
const dataDirectory = process.argv[3];

if ((phase !== "write" && phase !== "read") || !dataDirectory) {
  throw new Error("usage: bun run better-sqlite3.ts <write|read> <data-directory>");
}

mkdirSync(dataDirectory, { recursive: true });
const catalogPath = join(dataDirectory, "catalog.sqlite");
const userPath = join(dataDirectory, "user.sqlite");
const catalog = new Database(catalogPath, { fileMustExist: phase === "read" });
const user = new Database(userPath, { fileMustExist: phase === "read" });

try {
  if (phase === "write") {
    catalog.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY);
      INSERT INTO schema_migrations VALUES (1);
      CREATE TABLE works (id TEXT PRIMARY KEY, title TEXT NOT NULL);
    `);
    user.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY);
      INSERT INTO schema_migrations VALUES (1);
      CREATE TABLE marks (work_id TEXT PRIMARY KEY, favorite INTEGER NOT NULL);
    `);
    catalog.prepare("INSERT INTO works VALUES (?, ?)").run("work-1", "永続化テスト");
    user.prepare("INSERT INTO marks VALUES (?, ?)").run("work-1", 1);
  }

  const catalogRow = catalog.prepare("SELECT title FROM works WHERE id = ?").get("work-1") as
    | { title: string }
    | undefined;
  const userRow = user.prepare("SELECT favorite FROM marks WHERE work_id = ?").get("work-1") as
    | { favorite: number }
    | undefined;

  catalog.prepare("ATTACH DATABASE ? AS user_data").run(userPath);
  const attachedRow = catalog
    .prepare(
      "SELECT works.title, user_data.marks.favorite FROM works " +
        "JOIN user_data.marks ON user_data.marks.work_id = works.id",
    )
    .get() as { title: string; favorite: number } | undefined;

  if (
    catalogRow?.title !== "永続化テスト" ||
    userRow?.favorite !== 1 ||
    attachedRow?.title !== "永続化テスト" ||
    attachedRow.favorite !== 1
  ) {
    throw new Error(
      `unexpected persisted rows: ${JSON.stringify({ catalogRow, userRow, attachedRow })}`,
    );
  }

  console.log(`better-sqlite3 ${phase}: ok (catalog + user + ATTACH)`);
} finally {
  catalog.close();
  user.close();
}
