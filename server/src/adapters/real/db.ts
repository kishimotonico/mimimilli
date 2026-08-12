import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { constants, Database, SQLiteError } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { formatError, getCategoryLogger } from "../../lib/logger.ts";
import * as catalogSchema from "./catalogSchema.ts";
import {
  createDatabaseCandidatePath,
  replaceDatabaseWithCandidate,
} from "./databaseReplacement.ts";
import {
  createDatabaseBackup,
  hasPendingMigrations,
  moveDatabaseToBackup,
  purgeOldBackups,
  verifyDatabaseBackup,
  type DbBackupKind,
} from "./dbBackup.ts";
import { applySqliteBusyTimeout } from "./sqliteConnection.ts";
import * as userSchema from "./userSchema.ts";

export const CATALOG_SCHEMA_VERSION = 9;
const USER_SCHEMA_VERSION = 7;
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

export interface DbOpenOptions {
  /** 省略時は catalogPath の親の親（dataRoot）配下の backup/ を使う。 */
  backupDir?: string;
}

export interface Db {
  catalog: CatalogDb;
  user: UserDb;
  /** ATTACH済みのcatalog接続。DB間JOINと診断用に使う。 */
  sqlite: Database;
  /** catalog DB（main）上のトランザクション。ATTACH先のuserは含まない。 */
  transaction<T>(callback: () => T): T;
  /** user DB 接続上のトランザクション。catalogとは別ファイルのため原子性は共有されない。 */
  userTransaction<T>(callback: () => T): T;
  close(): void;
}

interface VersionedDatabaseContext {
  backupDir: string;
  kind: DbBackupKind;
}

type DbOpenPhase = "open" | "pragma" | "migrate" | "attach";

function logDbOpenFailure(
  kind: DbBackupKind,
  dbPath: string,
  phase: DbOpenPhase,
  error: unknown,
): never {
  const properties: Record<string, unknown> = {
    kind,
    dbPath,
    phase,
    ...formatError(error),
  };
  if (error instanceof SQLiteError && typeof error.code === "string" && error.code.length > 0) {
    properties.sqliteCode = error.code;
  }
  getCategoryLogger("db").error("データベースのオープンに失敗しました", properties);
  throw error;
}

function openVersionedDatabase(
  path: string,
  version: number,
  migrationsFolder: string,
  kind: DbBackupKind,
  context?: VersionedDatabaseContext,
): { sqlite: Database } {
  const isMemory = path.startsWith("file:") && path.includes("mode=memory");

  let sqlite: Database;
  let currentVersion: number;
  try {
    if (!isMemory) mkdirSync(dirname(path), { recursive: true });
    sqlite = new Database(path, isMemory ? SQLITE_URI_FLAGS : { create: true });
    const current = sqlite.query("PRAGMA user_version").get() as { user_version: number };
    currentVersion = current.user_version;
  } catch (error) {
    logDbOpenFailure(kind, path, "open", error);
  }

  if (kind === "catalog" && currentVersion !== 0 && currentVersion !== version) {
    if (isMemory) {
      logDbOpenFailure(
        kind,
        path,
        "open",
        new Error(
          `インメモリDBのスキーマバージョンが不一致です（DB: v${currentVersion}, アプリ: v${version}）`,
        ),
      );
    }
    sqlite.close();
    if (!context) {
      logDbOpenFailure(
        kind,
        path,
        "open",
        new Error("ファイルDBのスキーマ不一致時にはバックアップ先が必要です"),
      );
    }
    moveDatabaseToBackup(path, context.backupDir, context.kind, "version-mismatch");
    try {
      sqlite = new Database(path, { create: true });
    } catch (error) {
      logDbOpenFailure(kind, path, "open", error);
    }
  }

  try {
    sqlite.exec("PRAGMA journal_mode = WAL");
    sqlite.exec("PRAGMA foreign_keys = ON");
    applySqliteBusyTimeout(sqlite);
  } catch (error) {
    logDbOpenFailure(kind, path, "pragma", error);
  }

  try {
    if (!isMemory && context && hasPendingMigrations(sqlite, migrationsFolder)) {
      const backupPath = createDatabaseBackup(sqlite, context.backupDir, context.kind);
      verifyDatabaseBackup(backupPath, kind);
      purgeOldBackups(context.backupDir, context.kind);
      if (kind === "user") {
        const candidatePath = createDatabaseCandidatePath(path);
        copyFileSync(backupPath, candidatePath);
        sqlite.close();
        const candidate = new Database(candidatePath);
        try {
          candidate.exec("PRAGMA journal_mode = DELETE");
          candidate.exec("PRAGMA foreign_keys = ON");
          applySqliteBusyTimeout(candidate);
          migrate(drizzle(candidate), { migrationsFolder });
        } catch (error) {
          rmSync(candidatePath, { force: true });
          throw error;
        } finally {
          candidate.close();
        }
        replaceDatabaseWithCandidate(path, candidatePath);
        sqlite = new Database(path);
        sqlite.exec("PRAGMA journal_mode = WAL");
        sqlite.exec("PRAGMA foreign_keys = ON");
        applySqliteBusyTimeout(sqlite);
      } else {
        migrate(drizzle(sqlite), { migrationsFolder });
      }
    } else {
      const db = drizzle(sqlite);
      migrate(db, { migrationsFolder });
    }
  } catch (error) {
    logDbOpenFailure(kind, path, "migrate", error);
  }

  try {
    sqlite.exec(`PRAGMA user_version = ${version}`);
  } catch (error) {
    logDbOpenFailure(kind, path, "pragma", error);
  }

  return { sqlite };
}

/** catalogをmainとして開き、user DBを `user` という名前でATTACHする。 */
export function openDb(location: DbLocation, options?: DbOpenOptions): Db {
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
  const backupDir =
    location.kind === "files"
      ? (options?.backupDir ?? join(dirname(dirname(location.catalogPath)), "backup"))
      : undefined;
  const catalogContext =
    backupDir === undefined ? undefined : { backupDir, kind: "catalog" as const };
  const userContext = backupDir === undefined ? undefined : { backupDir, kind: "user" as const };
  const catalogOpened = openVersionedDatabase(
    catalogPath,
    CATALOG_SCHEMA_VERSION,
    CATALOG_MIGRATIONS,
    "catalog",
    catalogContext,
  );
  let userOpened: { sqlite: Database };
  try {
    userOpened = openVersionedDatabase(
      userPath,
      USER_SCHEMA_VERSION,
      USER_MIGRATIONS,
      "user",
      userContext,
    );
  } catch (error) {
    catalogOpened.sqlite.close();
    throw error;
  }
  try {
    try {
      catalogOpened.sqlite.run("ATTACH DATABASE ? AS user", [userPath]);
    } catch (error) {
      logDbOpenFailure("catalog", catalogPath, "attach", error);
    }
    const missing = catalogOpened.sqlite
      .query(
        "SELECT works.id FROM works LEFT JOIN user.work_states ON work_states.work_id = works.id " +
          "WHERE work_states.work_id IS NULL LIMIT 1",
      )
      .get() as { id: string } | null;
    if (missing) {
      logDbOpenFailure(
        "catalog",
        catalogPath,
        "attach",
        new Error(`DB整合性エラー: catalogの作品にuser状態がありません（workId: ${missing.id}）`),
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
    userTransaction: (callback) => user.transaction(callback),
    close(): void {
      catalogOpened.sqlite.close();
      userOpened.sqlite.close();
    },
  };
}
