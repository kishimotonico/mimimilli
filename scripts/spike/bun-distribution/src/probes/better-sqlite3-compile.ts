import Database from "better-sqlite3";

const db = new Database(":memory:");
db.exec("CREATE TABLE probe (value TEXT NOT NULL); INSERT INTO probe VALUES ('ok')");
const row = db.prepare("SELECT value FROM probe").get() as { value: string };
if (row.value !== "ok") {
  throw new Error("better-sqlite3 probe failed");
}
db.close();
console.log("better-sqlite3 compiled runtime probe: ok");
