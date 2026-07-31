import type { Database } from "bun:sqlite";

/** メイン接続とスキャンWorkerが同一user DBへ書くため、即時BUSYを避ける待機上限。 */
export const SQLITE_BUSY_TIMEOUT_MS = 5000;

export function applySqliteBusyTimeout(sqlite: Database): void {
  sqlite.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
}
