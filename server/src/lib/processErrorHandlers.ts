import { formatError } from "./logger.ts";

const UNHANDLED_REJECTION_MESSAGE = "未処理のPromise拒否を検出しました（プロセスは継続します）";
const MAX_REJECTION_SIGNATURE_COUNT = 256;
const OVERFLOW_SIGNATURE_MARKER = "\u001eoverflow";

function createRejectionSignature(properties: Record<string, unknown>): string {
  const errorKind = String(properties.errorKind ?? "");
  const code = String(properties.code ?? "");
  const message = String(properties.message ?? properties.content ?? "");
  return `${errorKind}\0${code}\0${message}`;
}

function createOverflowSignature(properties: Record<string, unknown>): string {
  const errorKind = String(properties.errorKind ?? "");
  const code = String(properties.code ?? "");
  return `${errorKind}\0${code}\0${OVERFLOW_SIGNATURE_MARKER}`;
}

function isPowerOfTen(n: number): boolean {
  if (n < 1) return false;
  while (n > 1) {
    if (n % 10 !== 0) return false;
    n = Math.floor(n / 10);
  }
  return true;
}

export function createUnhandledRejectionReporter(
  log: (message: string, properties: Record<string, unknown>) => void,
): (reason: unknown) => void {
  const occurrenceCounts = new Map<string, number>();

  return (reason: unknown) => {
    const formatted = formatError(reason);
    const signature = createRejectionSignature(formatted);
    let bucketKey = signature;
    let aggregated = false;

    if (!occurrenceCounts.has(signature)) {
      if (occurrenceCounts.size >= MAX_REJECTION_SIGNATURE_COUNT) {
        bucketKey = createOverflowSignature(formatted);
        aggregated = true;
      }
    }

    const occurrences = (occurrenceCounts.get(bucketKey) ?? 0) + 1;
    occurrenceCounts.set(bucketKey, occurrences);

    if (!isPowerOfTen(occurrences)) return;

    const properties: Record<string, unknown> = { ...formatted, occurrences };
    if (aggregated) properties.aggregated = true;
    log(UNHANDLED_REJECTION_MESSAGE, properties);
  };
}

export function registerProcessErrorHandlers(deps: {
  target: {
    on(event: "unhandledRejection", listener: (reason: unknown) => void): unknown;
    on(event: "uncaughtException", listener: (error: unknown) => void): unknown;
    on(event: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  };
  onUnhandledRejection: (reason: unknown) => void;
  onUncaughtException: (error: unknown) => void;
  onSignal: (signal: "SIGINT" | "SIGTERM") => void;
}): void {
  deps.target.on("unhandledRejection", deps.onUnhandledRejection);
  deps.target.on("uncaughtException", deps.onUncaughtException);
  deps.target.on("SIGINT", () => deps.onSignal("SIGINT"));
  deps.target.on("SIGTERM", () => deps.onSignal("SIGTERM"));
}
