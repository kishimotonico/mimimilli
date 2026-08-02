import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { Database } from "bun:sqlite";
import { Hono } from "hono";

function resolveDataDirectory(): string {
  const override = process.env.MIMIMILLI_DATA_DIR;
  if (override) {
    return isAbsolute(override) ? override : resolve(override);
  }
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) {
      throw new Error("LOCALAPPDATA is required when MIMIMILLI_DATA_DIR is not set");
    }
    return join(localAppData, "mimimilli");
  }
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "mimimilli");
}

const dataDirectory = resolveDataDirectory();
mkdirSync(dataDirectory, { recursive: true });
const db = new Database(join(dataDirectory, "spike.sqlite"), { create: true });
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
  INSERT OR IGNORE INTO schema_migrations VALUES (1);
  CREATE TABLE IF NOT EXISTS values_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS launches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    launched_at TEXT NOT NULL
  );
`);
db.query("INSERT INTO launches (launched_at) VALUES (?)").run(new Date().toISOString());

const app = new Hono();
app.get("/health", (context) => {
  const launches = db.query("SELECT COUNT(*) AS count FROM launches").get() as { count: number };
  return context.json({ dataDirectory, launches: launches.count, ok: true });
});
app.put("/values/:key", async (context) => {
  const body = (await context.req.json()) as { value?: unknown };
  if (typeof body.value !== "string") {
    return context.json({ error: "value must be a string" }, 400);
  }
  db.query(
    "INSERT INTO values_store (key, value) VALUES (?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(context.req.param("key"), body.value);
  return context.json({ ok: true });
});
app.get("/values/:key", (context) => {
  const row = db
    .query("SELECT value FROM values_store WHERE key = ?")
    .get(context.req.param("key")) as { value: string } | null;
  return row ? context.json(row) : context.json({ error: "not found" }, 404);
});

const port = Number(process.env.PORT ?? "1370");
const server = Bun.serve({ fetch: app.fetch, hostname: "127.0.0.1", port });
console.log(`mimimilli Bun spike listening on ${server.url} (data: ${dataDirectory})`);

function shutdown(): void {
  server.stop();
  db.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
