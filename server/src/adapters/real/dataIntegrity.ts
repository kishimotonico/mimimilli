import type { DataIntegrityWarning } from "@mimimilli/shared";
import type { SummaryLoadSkip } from "./workRowMapping.ts";

type DataIntegrityLogger = {
  warn: (message: string, properties?: Record<string, unknown>) => void;
};

export function toDataIntegrityWarning(
  skipped: SummaryLoadSkip[],
): DataIntegrityWarning | undefined {
  if (skipped.length === 0) return undefined;
  return {
    skippedCount: skipped.length,
    skippedWorkIds: skipped.map((skip) => skip.workId),
  };
}

export function logDataIntegritySkips(
  logger: DataIntegrityLogger,
  context: string,
  skipped: SummaryLoadSkip[],
): void {
  if (skipped.length === 0) return;
  logger.warn("データ不整合のため作品を除外しました", {
    context,
    skippedCount: skipped.length,
    skippedWorkIds: skipped.map((skip) => skip.workId),
    skips: skipped.map((skip) => ({ workId: skip.workId, reason: skip.reason })),
  });
}
