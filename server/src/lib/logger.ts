import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { getStreamFileSink } from "@logtape/file";
import {
  configure,
  configureSync,
  dispose,
  getAnsiColorFormatter,
  getConsoleSink,
  getLogger,
  type LogRecord,
  type Sink,
  type TextFormatter,
  withFilter,
} from "@logtape/logtape";

export type LogCategory = "dlsite" | "scan" | "db" | "http" | "server";

export const LOG_RETENTION_DAYS = 14;

/** コンソールへ出す最低レベル。debugはファイルのみに記録する。 */
const CONSOLE_LOWEST_LEVEL = "info";

/** file sinkのストリームバッファ長。超過時のみ書き込みに背圧がかかる。 */
const LOG_FILE_HIGH_WATER_MARK = 64 * 1024;

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

function createConsoleSink(): Sink {
  return withFilter(getConsoleSink({ formatter: getAnsiColorFormatter() }), CONSOLE_LOWEST_LEVEL);
}

function ensureConfigured(): void {
  if (configured) return;
  configureSync({
    sinks: {
      console: createConsoleSink(),
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

export interface InitLoggerResult {
  logFilePath: string | null;
}

export async function initLogger(options: InitLoggerOptions = {}): Promise<InitLoggerResult> {
  const sinkIds = ["console"];
  const sinks: Record<string, Sink> = { console: createConsoleSink() };

  let logFilePath: string | null = null;

  if (options.logDir) {
    const absoluteLogDir = resolve(options.logDir);
    try {
      mkdirSync(options.logDir, { recursive: true });
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? String((error as NodeJS.ErrnoException).code)
          : "UNKNOWN";
      throw new Error(`ログディレクトリの作成に失敗しました: ${absoluteLogDir} (${code})`, {
        cause: error,
      });
    }
    purgeOldLogFiles(options.logDir);
    logFilePath = join(options.logDir, `server-${formatLogDate(new Date())}.jsonl`);
    sinks.file = getStreamFileSink(logFilePath, {
      formatter: mimimilliJsonLinesFormatter(),
      highWaterMark: LOG_FILE_HIGH_WATER_MARK,
    });
    sinkIds.push("file");
  }

  await configure({
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
  return { logFilePath };
}

type DlsiteEventLevel = "debug" | "info" | "warning" | "error";

function resolveDlsiteEvent(event: Record<string, unknown>): {
  level: DlsiteEventLevel;
  message: string;
  context: Record<string, unknown>;
} {
  const { event: name, ...context } = event;
  const eventName = typeof name === "string" ? name : "unknown";
  switch (eventName) {
    case "dlsite_cache_hit":
      return { level: "debug", message: "DLsiteキャッシュヒット", context };
    case "dlsite_cache_miss":
      return { level: "debug", message: "DLsiteキャッシュミス", context };
    case "dlsite_parse_error":
      return { level: "warning", message: "DLsite HTMLのパースに失敗しました", context };
    case "dlsite_parse_fields_missing":
      return {
        level: "warning",
        message: "DLsite作品情報に欠落フィールドがあります",
        context,
      };
    case "dlsite_http_retry":
      return { level: "info", message: "DLsite HTTPリトライ", context };
    case "dlsite_http_request":
      return { level: "info", message: "DLsite HTTPリクエスト完了", context };
    default:
      return {
        level: "debug",
        message: "DLsiteイベント",
        context: { ...context, event: eventName },
      };
  }
}

/** dlsiteScheduler / realアダプタ向けのイベントロガー。 */
export function createDlsiteEventLogger(): (event: Record<string, unknown>) => void {
  const logger = getCategoryLogger("dlsite");
  return (event) => {
    const { level, message, context } = resolveDlsiteEvent(event);
    if (level === "warning") logger.warn(message, context);
    else if (level === "error") logger.error(message, context);
    else if (level === "info") logger.info(message, context);
    else logger.debug(message, context);
  };
}

function summarizeError(error: unknown): unknown {
  if (error instanceof Error) return { errorKind: error.name, message: error.message };
  return String(error);
}

export function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const properties: Record<string, unknown> = {
      errorKind: error.name,
      message: error.message,
      stack: error.stack,
    };
    if (error.cause !== undefined) properties.cause = summarizeError(error.cause);
    const suppressed = (error as { suppressed?: unknown }).suppressed;
    if (Array.isArray(suppressed) && suppressed.length > 0) {
      properties.suppressed = suppressed.map(summarizeError);
    }
    return properties;
  }
  return { message: String(error) };
}

export { dispose };
