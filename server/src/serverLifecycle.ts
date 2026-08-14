import type { DataAdapter } from "./adapter/index.ts";
import type { RealAdapter } from "./adapters/real/index.ts";
import { dispose } from "./lib/logger.ts";

/** DLsite同期fetchの総期限(60s)+余裕。Bun既定の10sアイドル制限を上書きする。 */
export const SERVER_IDLE_TIMEOUT_SECONDS = 90;

function isRealAdapter(value: DataAdapter): value is RealAdapter {
  return "close" in value && typeof value.close === "function";
}

export async function performGracefulShutdown(options: {
  server?: { stop: (closeActiveConnections?: boolean) => void };
  app: { shutdown(): Promise<void> };
  adapter?: DataAdapter;
}): Promise<void> {
  const { server, app, adapter } = options;

  try {
    if (server) server.stop();
  } catch (stopError) {
    console.error(stopError);
  }

  try {
    await app.shutdown();
  } catch (shutdownError) {
    console.error(shutdownError);
  }

  try {
    if (adapter && isRealAdapter(adapter)) adapter.close();
  } catch (closeError) {
    console.error(closeError);
  }

  try {
    await dispose();
  } catch (disposeError) {
    console.error(disposeError);
  }
}
