import { configureSync, disposeSync, type LogRecord } from "@logtape/logtape";
import type { LogCategory } from "../../src/lib/logger.ts";

export interface CaptureLogsOptions {
  categories?: LogCategory[];
}

export function captureLogs(
  run: (records: LogRecord[]) => void | Promise<void>,
  options: CaptureLogsOptions = {},
): Promise<void> {
  const categories = options.categories ?? (["scan"] as LogCategory[]);
  const records: LogRecord[] = [];
  configureSync({
    reset: true,
    sinks: {
      memory: (record) => records.push(record),
    },
    loggers: [
      ...categories.map((category) => ({
        category: [category],
        sinks: ["memory"],
        lowestLevel: "debug" as const,
      })),
      {
        category: ["logtape", "meta"],
        sinks: ["memory"],
        lowestLevel: "warning",
      },
    ],
  });
  return Promise.resolve(run(records)).finally(() => disposeSync());
}

export function categoryRecords(records: LogRecord[], category: LogCategory): LogRecord[] {
  return records.filter((record) => record.category[0] === category);
}

export function scanRecords(records: LogRecord[]): LogRecord[] {
  return categoryRecords(records, "scan");
}

export function recordMessage(record: { message: readonly unknown[] }): string {
  return String(record.message[0] ?? "");
}
