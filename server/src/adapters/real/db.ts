import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { constants, Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as catalogSchema from "./catalogSchema.ts";
import * as userSchema from "./userSchema.ts";

const CATALOG_SCHEMA_VERSION = 4;
const USER_SCHEMA_VERSION = 2;
const LEGACY_IMPORT_MARKER = "legacy_import_completed";
const SQLITE_URI_FLAGS =
  constants.SQLITE_OPEN_READWRITE | constants.SQLITE_OPEN_CREATE | constants.SQLITE_OPEN_URI;
const CATALOG_MIGRATIONS = fileURLToPath(new URL("../../../drizzle/catalog", import.meta.url));
const USER_MIGRATIONS = fileURLToPath(new URL("../../../drizzle/user", import.meta.url));

export type CatalogDb = BunSQLiteDatabase<typeof catalogSchema>;
export type UserDb = BunSQLiteDatabase<typeof userSchema>;

export type DbLocation =
  | { kind: "memory" }
  | {
      kind: "files";
      catalogPath: string;
      userPath: string;
      legacyPath?: string;
    };

export interface Db {
  catalog: CatalogDb;
  user: UserDb;
  /** ATTACH済みのcatalog接続。DB間JOINと診断用に使う。 */
  sqlite: Database;
  transaction<T>(callback: () => T): T;
  close(): void;
}

function removeDatabaseFiles(path: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`${path}${suffix}`, { force: true });
  }
}

function openVersionedDatabase(
  path: string,
  version: number,
  migrationsFolder: string,
): { sqlite: Database; recreated: boolean } {
  const isMemory = path.startsWith("file:") && path.includes("mode=memory");
  if (!isMemory) mkdirSync(dirname(path), { recursive: true });

  let sqlite = new Database(path, isMemory ? SQLITE_URI_FLAGS : { create: true });
  const current = sqlite.query("PRAGMA user_version").get() as { user_version: number };
  let recreated = false;
  if (current.user_version !== 0 && current.user_version !== version) {
    if (isMemory) {
      throw new Error(
        `インメモリDBのスキーマバージョンが不一致です（DB: v${current.user_version}, アプリ: v${version}）`,
      );
    }
    sqlite.close();
    removeDatabaseFiles(path);
    sqlite = new Database(path, { create: true });
    recreated = true;
  }

  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });
  sqlite.exec(`PRAGMA user_version = ${version}`);
  return { sqlite, recreated };
}

function assertLegacyTable(sqlite: Database, name: string): void {
  const row = sqlite
    .query("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  if (!row) throw new Error(`旧単一DBの必須テーブルがありません: ${name}`);
}

function completedLegacyImportSource(user: Database): string | null {
  const row = user
    .query("SELECT value FROM persistence_meta WHERE key = ?")
    .get(LEGACY_IMPORT_MARKER) as { value: string } | null;
  return row?.value ?? null;
}

/**
 * 旧単一DBからuser所有データだけを移す。旧DBは削除・改名せず、そのまま残す。
 * resume v1はPlaylist/Track ID移行まで同じ表現で保持する。
 */
function migrateLegacyUserData(legacyPath: string, user: Database): void {
  const legacy = new Database(legacyPath, { readonly: true });
  try {
    for (const table of [
      "works",
      "tag_prefixes",
      "app_settings",
      "search_presets",
      "smart_folders",
    ]) {
      assertLegacyTable(legacy, table);
    }

    const copy = user.transaction(() => {
      const insertState = user.query(`
        INSERT INTO work_states
          (work_id, added_at, bookmarked, last_played_at, resume_position, resume_track_index)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(work_id) DO UPDATE SET
          added_at = excluded.added_at,
          bookmarked = excluded.bookmarked,
          last_played_at = excluded.last_played_at,
          resume_position = excluded.resume_position,
          resume_track_index = excluded.resume_track_index
      `);
      for (const row of legacy
        .query(
          "SELECT id, added_at, bookmarked, last_played_at, resume_position, resume_track_index FROM works",
        )
        .all() as Array<Record<string, string | number | null>>) {
        insertState.run(
          row.id,
          row.added_at,
          row.bookmarked,
          row.last_played_at,
          row.resume_position,
          row.resume_track_index,
        );
      }

      for (const table of ["tag_prefixes", "search_presets", "smart_folders"] as const) {
        const columns = {
          tag_prefixes: "id, prefix, label, color, show_as_axis, protected",
          search_presets: "id, name, query, tag_filters_json, sort_id",
          smart_folders: "id, name, rules_json, sort, created_at",
        }[table];
        const rows = legacy.query(`SELECT ${columns} FROM ${table}`).all() as Array<
          Record<string, string | number | null>
        >;
        if (rows.length === 0) continue;
        const names = columns.split(", ");
        const placeholders = names.map(() => "?").join(", ");
        const updates = names
          .filter((name) => name !== "id")
          .map((name) => `${name} = excluded.${name}`)
          .join(", ");
        const statement = user.query(
          `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ` +
            `ON CONFLICT(id) DO UPDATE SET ${updates}`,
        );
        for (const row of rows) statement.run(...names.map((name) => row[name]));
      }

      const insertSetting = user.query(
        "INSERT INTO app_settings (key, value) VALUES (?, ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      );
      for (const row of legacy
        .query("SELECT key, value FROM app_settings WHERE key <> 'last_scan_time'")
        .all() as Array<{ key: string; value: string | null }>) {
        insertSetting.run(row.key, row.value);
      }

      user
        .query("INSERT INTO persistence_meta (key, value) VALUES (?, ?)")
        .run(LEGACY_IMPORT_MARKER, legacyPath);
    });
    copy();
  } finally {
    legacy.close();
  }
}

/** catalogをmainとして開き、user DBを `user` という名前でATTACHする。 */
export function openDb(location: DbLocation): Db {
  if (
    location.kind === "files" &&
    (!isAbsolute(location.catalogPath) ||
      !isAbsolute(location.userPath) ||
      (location.legacyPath !== undefined && !isAbsolute(location.legacyPath)))
  ) {
    throw new Error("SQLiteのファイルパスには絶対パスを指定してください");
  }
  const memoryId = crypto.randomUUID();
  const catalogPath =
    location.kind === "memory"
      ? `file:mimikago-catalog-${memoryId}?mode=memory&cache=shared`
      : location.catalogPath;
  const userPath =
    location.kind === "memory"
      ? `file:mimikago-user-${memoryId}?mode=memory&cache=shared`
      : location.userPath;
  let catalogOpened = openVersionedDatabase(
    catalogPath,
    CATALOG_SCHEMA_VERSION,
    CATALOG_MIGRATIONS,
  );
  const userOpened = openVersionedDatabase(userPath, USER_SCHEMA_VERSION, USER_MIGRATIONS);
  if (location.kind === "files" && userOpened.recreated && !catalogOpened.recreated) {
    catalogOpened.sqlite.close();
    removeDatabaseFiles(catalogPath);
    catalogOpened = openVersionedDatabase(catalogPath, CATALOG_SCHEMA_VERSION, CATALOG_MIGRATIONS);
  }
  let userClosed = false;

  try {
    if (location.kind === "files" && location.legacyPath) {
      const completedSource = completedLegacyImportSource(userOpened.sqlite);
      if (completedSource !== null && completedSource !== location.legacyPath) {
        throw new Error(`user DBには別の旧単一DBからの移行完了記録があります: ${completedSource}`);
      }
      if (completedSource === null) {
        if (!existsSync(location.legacyPath)) {
          throw new Error(`移行元の旧単一DBが存在しません: ${location.legacyPath}`);
        }
        try {
          migrateLegacyUserData(location.legacyPath, userOpened.sqlite);
          console.info(`旧単一DBからuserデータを移行しました: ${location.legacyPath}`);
        } catch (error) {
          userOpened.sqlite.close();
          userClosed = true;
          removeDatabaseFiles(userPath);
          throw new Error(`旧単一DBからuserデータを移行できませんでした: ${location.legacyPath}`, {
            cause: error,
          });
        }
      }
    }

    catalogOpened.sqlite.run("ATTACH DATABASE ? AS user", [userPath]);
    const missing = catalogOpened.sqlite
      .query(
        "SELECT works.id FROM works LEFT JOIN user.work_states ON work_states.work_id = works.id " +
          "WHERE work_states.work_id IS NULL LIMIT 1",
      )
      .get() as { id: string } | null;
    if (missing) {
      throw new Error(
        `DB整合性エラー: catalogの作品にuser状態がありません（workId: ${missing.id}）`,
      );
    }
  } catch (error) {
    catalogOpened.sqlite.close();
    if (!userClosed) userOpened.sqlite.close();
    throw error;
  }

  const catalog = drizzle(catalogOpened.sqlite, { schema: catalogSchema });
  const user = drizzle(userOpened.sqlite, { schema: userSchema });
  return {
    catalog,
    user,
    sqlite: catalogOpened.sqlite,
    transaction: (callback) => catalog.transaction(callback),
    close(): void {
      catalogOpened.sqlite.close();
      userOpened.sqlite.close();
    },
  };
}
