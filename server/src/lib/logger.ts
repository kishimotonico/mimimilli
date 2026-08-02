import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { getFileSink } from "@logtape/file";
import {
  configureSync,
  dispose,
  disposeSync,
  getAnsiColorFormatter,
  getConsoleSink,
  getLogger,
  type LogRecord,
  type TextFormatter,
} from "@logtape/logtape";

export type LogCategory = "dlsite" | "scan" | "db" | "http" | "server";

export const LOG_RETENTION_DAYS = 14;

const LOG_CATEGORIES: LogCategory[] = ["dlsite", "scan", "db", "http", "server"];
const LOG_FILE_PATTERN = /^server-(\d{4}-\d{2}-\d{2})\.jsonl$/;

let configured = false;

function renderMessage(record: LogRecord): string {
  const parts = record.message;
  if (parts.length === 1) return String(parts[0]);
  let message = "";
  for (let i = 0; i < parts.length; i++) {
    message += i % 2 < 1 ? String(parts[i]) : JSON.stringify(parts[i]);
  }
  return message;
}

function formatLevel(level: LogRecord["level"]): string {
  return level === "warning" ? "WARN" : level.toUpperCase();
}

function mimimilliJsonLinesFormatter(): TextFormatter {
  return (record) =>
    `${JSON.stringify({
      ts: new Date(record.timestamp).toISOString(),
      level: formatLevel(record.level),
      category: record.category.join("."),
      message: renderMessage(record),
      properties: record.properties,
    })}\n`;
}

function formatLogDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function purgeOldLogFiles(logDir: string, retentionDays = LOG_RETENTION_DAYS): void {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let entries: string[];
  try {
    entries = readdirSync(logDir);
  } catch {
    return;
  }
  for (const name of entries) {
    const match = LOG_FILE_PATTERN.exec(name);
    if (!match) continue;
    const fileDate = Date.parse(`${match[1]}T00:00:00`);
    if (Number.isNaN(fileDate) || fileDate < cutoff) {
      unlinkSync(join(logDir, name));
    }
  }
}

function ensureConfigured(): void {
  if (configured) return;
  configureSync({
    sinks: {
      console: getConsoleSink({ formatter: getAnsiColorFormatter() }),
    },
    loggers: [
      ...LOG_CATEGORIES.map((category) => ({
        category: [category],
        sinks: ["console"],
        lowestLevel: "debug" as const,
      })),
      {
        category: ["logtape", "meta"],
        sinks: ["console"],
        lowestLevel: "warning" as const,
      },
    ],
  });
  configured = true;
}

/** カテゴリ別ロガーを返す。未初期化時は console sink のみで構成する。 */
export function getCategoryLogger(category: LogCategory) {
  ensureConfigured();
  return getLogger(category);
}

export interface InitLoggerOptions {
  /** 指定時は file sink を有効化し、古いログファイルを削除する。 */
  logDir?: string;
}

export function initLogger(options: InitLoggerOptions = {}): void {
  const sinkIds = ["console"];
  const sinks: Record<string, ReturnType<typeof getConsoleSink> | ReturnType<typeof getFileSink>> =
    {
      console: getConsoleSink({ formatter: getAnsiColorFormatter() }),
    };

  if (options.logDir) {
    mkdirSync(options.logDir, { recursive: true });
    purgeOldLogFiles(options.logDir);
    const logFile = join(options.logDir, `server-${formatLogDate(new Date())}.jsonl`);
    sinks.file = getFileSink(logFile, { formatter: mimimilliJsonLinesFormatter() });
    sinkIds.push("file");
  }

  configureSync({
    reset: true,
    sinks,
    loggers: [
      ...LOG_CATEGORIES.map((category) => ({
        category: [category],
        sinks: sinkIds,
        lowestLevel: "debug" as const,
      })),
      {
        category: ["logtape", "meta"],
        sinks: ["console"],
        lowestLevel: "warning" as const,
      },
    ],
  });
  configured = true;
}

const DLSITE_EVENT_MESSAGES: Record<string, string> = {
  dlsite_cache_hit: "DLsiteキャッシュヒット",
  dlsite_cache_miss: "DLsiteキャッシュミス",
  dlsite_parse_error: "DLsite HTMLのパースに失敗",
  dlsite_http_retry: "DLsite HTTPリトライ",
  dlsite_http_request: "DLsite HTTPリクエスト",
};

/** dlsiteScheduler / realアダプタ向けのイベントロガー。 */
export function createDlsiteEventLogger(): (event: Record<string, unknown>) => void {
  const logger = getCategoryLogger("dlsite");
  return (event) => {
    const { event: name, ...context } = event;
    const message =
      typeof name === "string" && name in DLSITE_EVENT_MESSAGES
        ? DLSITE_EVENT_MESSAGES[name]!
        : "DLsiteイベント";
    const level =
      name === "dlsite_parse_error" ? "warn" : name === "dlsite_http_retry" ? "info" : "debug";
    logger[level](message, context);
  };
}

export function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { errorKind: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

export { dispose, disposeSync };
