import type { DataAdapter } from "./adapter/index.ts";
import { createApp, type App, type CreateAppOptions } from "./app.ts";

/** DLsite同期fetchの総期限(60s)+余裕。Bun既定の10sアイドル制限を上書きする。 */
export const SERVER_IDLE_TIMEOUT_SECONDS = 90;

export type BunServer = ReturnType<typeof Bun.serve>;

export type ServeResult = {
  app: App;
  server: BunServer;
};

export type ServeOptions = {
  adapter: DataAdapter;
  port: number;
  appOptions?: CreateAppOptions;
};

export function serveMimimilli(options: ServeOptions): ServeResult {
  const { adapter, port, appOptions } = options;
  const app = createApp(adapter, appOptions ?? {});
  const server = Bun.serve({
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port,
    idleTimeout: SERVER_IDLE_TIMEOUT_SECONDS,
  });
  return { app, server };
}
