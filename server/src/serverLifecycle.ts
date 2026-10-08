import type { DataAdapter } from "./adapter/index.ts";
import { dispose } from "./lib/logger.ts";

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

export type ShutdownResult = { timedOut: boolean };

async function closeAdapter(adapter: DataAdapter | undefined): Promise<void> {
  try {
    if (adapter) {
      const closeResult = adapter.close?.();
      if (closeResult instanceof Promise) await closeResult;
    }
  } catch (closeError) {
    console.error(closeError);
  }
}

async function runShutdownSteps(options: {
  server?: { stop: (closeActiveConnections?: boolean) => void };
  app?: { shutdown(): Promise<void> };
  adapter?: DataAdapter;
}): Promise<void> {
  const { server, app, adapter } = options;

  try {
    if (server) server.stop();
  } catch (stopError) {
    console.error(stopError);
  }

  try {
    await app?.shutdown();
  } catch (shutdownError) {
    console.error(shutdownError);
  }

  await closeAdapter(adapter);

  try {
    await dispose();
  } catch (disposeError) {
    console.error(disposeError);
  }
}

export async function performGracefulShutdown(options: {
  server?: { stop: (closeActiveConnections?: boolean) => void };
  app?: { shutdown(): Promise<void> };
  adapter?: DataAdapter;
  terminateWorkers?: () => void;
  timeoutMs?: number;
}): Promise<ShutdownResult> {
  const { terminateWorkers, timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    const outcome = await Promise.race([runShutdownSteps(options), timeout]);
    if (outcome !== "timeout") return { timedOut: false };
  } finally {
    clearTimeout(timer);
  }

  console.error(`終了処理が${timeoutMs}ms以内に完了しなかったため強制終了します`);
  try {
    terminateWorkers?.();
  } catch (terminateError) {
    console.error(terminateError);
  }
  await closeAdapter(options.adapter);
  return { timedOut: true };
}

export async function runCleanupAndExit(
  cleanup: () => Promise<void | ShutdownResult>,
  exitCode: number,
  exit: (code: number) => never = process.exit,
): Promise<never> {
  let code = exitCode;
  try {
    const result = await cleanup();
    if (result?.timedOut) code = 1;
  } catch (error) {
    console.error(error);
  } finally {
    exit(code);
  }
}

export function createShutdownHandler(deps: {
  cleanup: () => Promise<void | ShutdownResult>;
  exit?: (code: number) => never;
  log: (reason: string, error?: unknown) => void;
}): (request: {
  exitCode: number;
  immediateExitCode: number;
  reason: string;
  error?: unknown;
}) => Promise<void> {
  const exit = deps.exit ?? process.exit;
  let started = false;
  return async ({ exitCode, immediateExitCode, reason, error }) => {
    if (started) exit(immediateExitCode);
    started = true;
    try {
      deps.log(reason, error);
    } catch (logError) {
      console.error(logError);
    }
    await runCleanupAndExit(deps.cleanup, exitCode, exit);
  };
}
