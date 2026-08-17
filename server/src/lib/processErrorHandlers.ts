import { formatError } from "./logger.ts";

const UNHANDLED_REJECTION_MESSAGE = "未処理のPromise拒否を検出しました（プロセスは継続します）";

function createRejectionSignature(properties: Record<string, unknown>): string {
  const errorKind = String(properties.errorKind ?? "");
  const code = String(properties.code ?? "");
  const message = String(properties.message ?? properties.content ?? "");
  return `${errorKind}\0${code}\0${message}`;
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
    const occurrences = (occurrenceCounts.get(signature) ?? 0) + 1;
    occurrenceCounts.set(signature, occurrences);

    if (!isPowerOfTen(occurrences)) return;

    log(UNHANDLED_REJECTION_MESSAGE, { ...formatted, occurrences });
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
