import type { DataAdapter } from "./adapter/index.ts";
import { dispose } from "./lib/logger.ts";

export async function performGracefulShutdown(options: {
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

  try {
    if (adapter) {
      const closeResult = adapter.close?.();
      if (closeResult instanceof Promise) await closeResult;
    }
  } catch (closeError) {
    console.error(closeError);
  }

  try {
    await dispose();
  } catch (disposeError) {
    console.error(disposeError);
  }
}

export async function runCleanupAndExit(
  cleanup: () => Promise<void>,
  exitCode: number,
  exit: (code: number) => never = process.exit,
): Promise<never> {
  try {
    await cleanup();
  } catch (error) {
    console.error(error);
  } finally {
    exit(exitCode);
  }
}
