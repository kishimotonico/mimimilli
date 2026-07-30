import { mkdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { constants, Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as catalogSchema from "./catalogSchema.ts";
import { applySqliteBusyTimeout } from "./sqliteConnection.ts";
import * as userSchema from "./userSchema.ts";

const CATALOG_SCHEMA_VERSION = 7;
const USER_SCHEMA_VERSION = 6;
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
  migratableVersions: readonly number[] = [],
): { sqlite: Database; recreated: boolean } {
  const isMemory = path.startsWith("file:") && path.includes("mode=memory");
  if (!isMemory) mkdirSync(dirname(path), { recursive: true });

  let sqlite = new Database(path, isMemory ? SQLITE_URI_FLAGS : { create: true });
  const current = sqlite.query("PRAGMA user_version").get() as { user_version: number };
  let recreated = false;
  if (
    current.user_version !== 0 &&
    current.user_version !== version &&
    !migratableVersions.includes(current.user_version)
  ) {
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
  applySqliteBusyTimeout(sqlite);
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });
  sqlite.exec(`PRAGMA user_version = ${version}`);
  return { sqlite, recreated };
}

/** catalogをmainとして開き、user DBを `user` という名前でATTACHする。 */
export function openDb(location: DbLocation): Db {
  if (
    location.kind === "files" &&
    (!isAbsolute(location.catalogPath) || !isAbsolute(location.userPath))
  ) {
    throw new Error("SQLiteのファイルパスには絶対パスを指定してください");
  }
  const memoryId = crypto.randomUUID();
  const catalogPath =
    location.kind === "memory"
      ? `file:mimimilli-catalog-${memoryId}?mode=memory&cache=shared`
      : location.catalogPath;
  const userPath =
    location.kind === "memory"
      ? `file:mimimilli-user-${memoryId}?mode=memory&cache=shared`
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
  try {
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
    userOpened.sqlite.close();
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
